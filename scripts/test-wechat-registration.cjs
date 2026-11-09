const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  new Function("require", "module", "exports", code)((id) => mocks[id] ?? require(id), module, module.exports);
  return module.exports;
}

async function main() {
  const profile = load("lib/wechat-profile.ts");
  const avatar = "https://thirdwx.qlogo.cn/mmopen/vi_32/test/132";
  assert.equal(profile.wechatAvatarUrl(avatar.replace("https:", "http:") + "?discard=1"), avatar);
  assert.equal(profile.wechatAvatarUrl("https://thirdwx.qlogo.cn.evil.example/mmopen/test"), null);
  const pay = load("lib/wechat-pay.ts", { "server-only": {} });
  const start = load("app/api/auth/wechat/route.ts", {
    "@/lib/wechat-pay": { ...pay, wechatOauthConfigured: () => true },
    "@/lib/wechat-profile": profile
  }).GET;

  for (const [query, scope, choice] of [
    ["", "snsapi_base", "00"],
    ["&name=1", "snsapi_userinfo", "10"],
    ["&avatar=1", "snsapi_userinfo", "01"],
    ["&name=1&avatar=1", "snsapi_userinfo", "11"]
  ]) {
    const res = await start(new Request("https://xiaoxuanvip.com/api/auth/wechat?return=%2Flibrary" + query, {
      headers: { cookie: "wx_openid=unverified" }
    }));
    assert.equal(new URL(res.headers.get("location")).searchParams.get("scope"), scope);
    assert.equal(res.cookies.get("wx_login_profile").value, choice);
    assert.equal(res.cookies.get("wx_login_return").value, "/library");
    assert.equal(res.cookies.get("xx_access_token"), undefined);
  }

  let isNew = true;
  let currentChoice = "00";
  let saved;
  let upsert;
  let fetches = 0;
  let loginCalls = 0;
  const tokens = { user: { id: "registered-user" }, access_token: "access", refresh_token: "refresh" };
  const auth = {
    authFetch: async () => saved || !isNew ? Response.json(tokens) : Response.json({}, { status: 400 }),
    recordLoginEvent: async () => {},
    applyAuthCookies: () => {}
  };
  const login = load("lib/wechat-login.ts", {
    "server-only": {},
    "@/lib/server-auth": auth,
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({
      auth: { admin: { createUser: async (payload) => {
        saved = payload;
        return { data: { user: tokens.user }, error: null };
      } } },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        upsert: async (payload) => { upsert = payload; }
      })
    }) }
  });
  const callback = load("app/api/auth/wechat/callback/route.ts", {
    "next/headers": { cookies: () => ({ get: (key) => ({
      value: { wx_login_return: "/library", wx_login_state: "nonce", wx_login_profile: currentChoice }[key]
    }) }) },
    "@/lib/server-auth": auth,
    "@/lib/wechat-pay": {
      exchangeWechatOauthCode: async () => ({ openid: "provider-id" }),
      fetchWechatOauthProfile: async () => { fetches++; return { nickname: " 测试用户 ", avatarUrl: avatar }; }
    },
    "@/lib/wechat-login": { loginWithWechatOpenid: (...args) => { loginCalls++; return login.loginWithWechatOpenid(...args); } },
    "@/lib/wechat-profile": profile
  }).GET;
  const complete = (state = "nonce") => callback(new Request("https://xiaoxuanvip.com/api/auth/wechat/callback?code=valid&state=" + state));
  for (const [choice, nickname, avatarUrl] of [
    ["00", "微信用户", undefined],
    ["10", "测试用户", undefined],
    ["01", "微信用户", avatar],
    ["11", "测试用户", avatar]
  ]) {
    saved = undefined;
    currentChoice = choice;
    const res = await complete();
    assert.equal(new URL(res.headers.get("location")).pathname, "/library");
    assert.equal(saved.user_metadata.nickname, nickname);
    assert.equal(saved.app_metadata?.wechat_avatar_url, avatarUrl);
    assert.equal(upsert.nickname, nickname);
  }
  assert.equal(fetches, 3, "No request for profile data without an opt-in");
  saved = undefined;
  isNew = false;
  await complete();
  assert.equal(saved, undefined, "Returning users are never created again");
  assert.equal(upsert.nickname, undefined, "Returning users' names are not overwritten");
  assert.equal(fetches, 3, "Returning users' WeChat profiles are not fetched again");
  const before = loginCalls;
  await complete("incorrect");
  assert.equal(loginCalls, before, "An invalid OAuth state cannot log in");
  console.log("PASS: independent opt-ins, fallback defaults, verified callback, and existing profile preservation");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
