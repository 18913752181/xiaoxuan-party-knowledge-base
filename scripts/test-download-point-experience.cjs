const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, mocks = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  new Function("require", "module", "exports", source)((id) => mocks[id] || require(id), module, module.exports);
  return module.exports;
}

async function main() {
  const view = load("lib/material-point-view.ts");
  const state = { paid: true, legacyBenefits: false, pointsBalance: 2, unlockedSlugs: ["old"] };
  const items = [{ slug: "old", cost: 99 }, { slug: "new", cost: 3 }, { slug: "new", cost: 3 }, { slug: "free", cost: 0 }];
  assert.deepEqual(view.quoteMaterialPoints(state, items), {
    slugs: ["old", "new", "free"], requiredPoints: 3, pointsBalance: 2,
    shortfallPoints: 1, unlockedCount: 1, legacyBenefits: false, dailyLimit: null, dailyRemaining: 0, requestedNew: 0, dailyExceeded: false
  });
  assert.equal(view.quoteMaterialPoints({ ...state, legacyBenefits: true }, items).requiredPoints, 0);
  assert.equal(view.materialDownloadLabel(state, "old", 99, true), "已解锁，免费下载");
  assert.equal(view.materialDownloadLabel(state, "new", 1, true), "下载 · 1积分");
  assert.equal(view.materialDownloadLabel({ ...state, legacyBenefits: true }, "old", 99, true), "原会员权益，免扣积分");
  assert.equal(view.materialDownloadLabel({ ...state, paid: false }, "old", 99, true), "开通会员下载", "An unlock cannot bypass expired membership");

  const rpcCalls = [];
  let dbFailure = false;
  const service = load("lib/material-point-state.ts", {
    "server-only": {},
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ rpc: async (name,args) => {
      rpcCalls.push([name,args]); return {data: state, error: dbFailure ? {message:"offline"}:null};
    } }) }
  });
  let actual = await service.getMaterialPointState("session-user");
  assert.deepEqual(actual,state);
  assert.deepEqual(rpcCalls, [["material_download_state", {p_user_id:"session-user"}]]);
  dbFailure = true;
  await assert.rejects(service.getMaterialPointState("session-user"));
  const annual = { ...state, policy:"annual_daily", canDownload:true, dailyLimit:10, dailyUsed:9, dailyRemaining:1, todayDownloadedSlugs:["old"] };
  const annualQuote = view.quoteMaterialPoints(annual,items);
  assert.equal(annualQuote.requestedNew,2);
  assert.equal(annualQuote.dailyExceeded,true);
  assert.equal(view.materialDownloadLabel({...annual,canDownload:false},"old",1,true),"开通年卡下载");

  let signedIn = true;
  let current = state;
  let stateFailure = false;
  const api = load("app/api/material-points/route.ts", {
    "@/lib/server-auth": { getServerSession: async () => signedIn ? { user: { id: "session-user" } } : null, applyAuthCookies() {} },
    "@/lib/material-point-state": { getMaterialPointState: async (id) => { assert.equal(id, "session-user"); if (stateFailure) throw Error(); return current; } },
    "@/lib/material-point-view": view,
    "@/lib/content-units": { getContentUnitBySlug: async (slug) => slug === "missing" ? null : { meta: { pointsCost: 3 } }, getContentUnitDownloadFilePath: async () => ({ path: "file.docx" }) }
  });
  const quoteRequest = (slugs, batch = true) => new Request("http://localhost/api/material-points", { method: "POST", body: JSON.stringify({ slugs, batch, cost: 0, userId: "another-user" }) });
  let response = await api.POST(quoteRequest(["old", "content-new", "new"]));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  actual = await response.json();
  assert.equal(actual.requiredPoints, 3, "Prices come from server content, never request data");
  assert.equal(actual.shortfallPoints, 1);
  assert.equal((await api.POST(quoteRequest(Array(51).fill("new")))).status, 400);
  assert.equal((await api.POST(quoteRequest(["missing"]))).status, 404);
  current = { ...state, legacyBenefits: true };
  assert.equal((await (await api.POST(quoteRequest(["new"]))).json()).requiredPoints, 0);
  current = { ...state, paid: false };
  assert.equal((await api.POST(quoteRequest(["new"]))).status, 403);
  assert.equal((await api.POST(quoteRequest(["new"], false))).status, 200, "An ordinary legacy single download keeps its existing point-based permission");
  current = { ...state, policy: "annual_daily", canDownload: false };
  assert.equal((await api.POST(quoteRequest(["new"], false))).status, 403, "New monthly members cannot bypass annual access through a single quote");
  signedIn = false;
  assert.equal((await api.GET()).status, 401);
  assert.equal((await api.POST(quoteRequest(["new"]))).status, 401);
  signedIn = true; stateFailure = true;
  assert.equal((await api.GET()).status, 503, "Never display a guessed balance after a database failure");

  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const linkMock = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
  const statusUI = load("components/MaterialDownloadStatus.tsx", { "next/link": linkMock });
  const shortfallUI = load("components/InsufficientPointsNotice.tsx", { "next/link": linkMock });
  const html = renderToStaticMarkup(React.createElement(statusUI.MaterialDownloadStatus, { state: { ...annual, pointsBalance: 15, permanentPoints: 10, dailyPoints: 5 } }));
  const visibleText = html.replace(/<[^>]*>/g, "");
  assert.match(visibleText, /今日已下载 9\/10/);
  assert.match(visibleText, /长期积分 10/);
  assert.match(visibleText, /今日赠送剩余 5/);
  assert.match(visibleText, /优先消耗/);
  const insuff = renderToStaticMarkup(React.createElement(shortfallUI.InsufficientPointsNotice, { requiredPoints: 5, pointsBalance: 2 }));
  assert.match(insuff.replace(/<[^>]*>/g, ""), /本次需要 5 积分，现有 2 积分，还差 3 积分/);
  assert.match(insuff, /href="\/me"/);

  let profileQueryError = null;
  let balanceReadFailure = false;
  const profileAPI = load("app/api/auth/profile/route.ts", {
    "@supabase/supabase-js": { createClient: () => ({ from: () => {
      const q = { select: () => q, eq: (key, id) => { assert.equal(id, "session-user"); return q; }, maybeSingle: async () => ({ data: { id: "session-user", points_balance: 10, wechat_openid: "fake-private-id" }, error: profileQueryError }) };
      return q;
    } }) },
    "@/lib/server-auth": { getServerSession: async () => ({ user: { id: "session-user" }, accessToken: "fake-token" }), applyAuthCookies() {} },
    "@/lib/material-point-state": { getMaterialPointState: async () => {
      if (balanceReadFailure) throw Error("offline");
      return { ...annual, pointsBalance: 15, permanentPoints: 10, dailyPoints: 5 };
    } }
  });
  response = await profileAPI.GET();
  actual = await response.json();
  assert.equal(actual.profile.points_balance, 15);
  assert.equal(actual.profile.permanent_points_balance, 10);
  assert.equal(actual.profile.daily_points_balance, 5);
  assert.equal(actual.profile.wechat_openid, undefined);
  assert.match(response.headers.get("cache-control"), /no-store/);
  balanceReadFailure = true;
  assert.equal((await profileAPI.GET()).status, 503);
  balanceReadFailure = false; profileQueryError = { message: "offline" };
  assert.equal((await profileAPI.GET()).status, 503);

  // Download transport preserves structured errors and notifies mounted pages.
  const events = [];
  const savedFetch = global.fetch;
  const savedURL = global.URL;
  global.window = { dispatchEvent: (event) => events.push(event.type), setTimeout: () => {} };
  global.document = { body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) };
  global.URL = { createObjectURL: () => "blob:test", revokeObjectURL() {} };
  const transport = load("lib/download-file.ts");
  const material = { id: "new", slug: "new", file_url: "/download", title: "Test" };
  try {
    global.fetch = async () => Response.json({ code: "INSUFFICIENT_POINTS", error: "不足", requiredPoints: 5, pointsBalance: 2 }, { status: 403 });
    actual = await transport.downloadMaterialFile(material);
    assert.equal(actual.insufficientPoints, true);
    assert.equal(actual.requiredPoints, 5);
    assert.equal(actual.pointsBalance, 2);
    assert(events.includes("material-points-changed"));
    global.fetch = async (url) => url === "/download" ? new Response("file", { headers: { "X-Material-Points-Charged": "1", "X-Material-Points-Balance": "8" } }) : new Response(null, { status: 401 });
    actual = await transport.downloadMaterialFile(material);
    assert.equal(actual.chargedPoints, 1);
    assert.equal(actual.pointsBalance, 8);
    global.fetch = async () => { throw Error("network"); };
    actual = await transport.downloadMaterialFile(material);
    assert.equal(actual.ok, false);
    assert.match(actual.error, /不会重复扣分/);
  } finally { global.fetch = savedFetch; global.URL = savedURL; delete global.window; delete global.document; }

  // Exercise AuthProvider's real event handler without browser credentials.
  const slots = [];
  let cursor = 0;
  const effects = [];
  const listeners = new Map();
  const hooks = {
    createContext: () => ({ Provider: "provider" }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useCallback(fn) { const i = cursor++; return slots[i] ||= fn; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
    useMemo(fn) { cursor++; return fn(); }
  };
  const auth = load("contexts/AuthContext.tsx", { react: hooks, "@/lib/supabase/client": { isSupabaseConfigured: true } });
  const render = () => { cursor = 0; return auth.AuthProvider({ children: null }).props.value; };
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  let balance = 10;
  let profileStatus = 200;
  global.window = {
    addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: (event) => listeners.delete(event)
  };
  global.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  global.fetch = async () => profileStatus === 200 ? Response.json({ profile: { id: "account", points_balance: balance } }) : new Response(null, { status: profileStatus });
  let cleanup;
  try {
    render(); cleanup = effects[0](); await tick();
    assert.equal(render().profile.points_balance, 10);
    balance = 9; listeners.get("material-points-changed")(); await tick();
    assert.equal(render().profile.points_balance, 9, "My-page context refreshes after a download without reload");
    profileStatus = 503; listeners.get("focus")(); await tick();
    assert.equal(render().profile.points_balance, 9, "Transient failures cannot reset the visible balance");
    profileStatus = 401; listeners.get("focus")(); await tick();
    assert.equal(render().profile, null, "Expired login clears the old account");
  } finally {
    cleanup?.(); global.fetch = savedFetch; delete global.window; delete global.document;
  }

  console.log("PASS: exact quotes, unlock/legacy labels, expired permissions, account isolation, private API, shortfalls, download balance and automatic My-page refresh");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
