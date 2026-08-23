import crypto from "node:crypto";

const baseUrl = process.env.TEST_WECHAT_URL || "http://localhost:3000/api/wechat";
const token = process.env.WECHAT_TOKEN || "local-work-cat-token";
const aesKeyText = process.env.WECHAT_ENCODING_AES_KEY || "";
const appId = process.env.WECHAT_OFFICIAL_APP_ID || process.env.WECHAT_APP_ID || "";

function signature(timestamp, nonce) {
  return crypto.createHash("sha1").update([token, timestamp, nonce].sort().join("")).digest("hex");
}

function messageSignature(timestamp, nonce, encrypted) {
  return crypto.createHash("sha1").update([token, timestamp, nonce, encrypted].sort().join("")).digest("hex");
}

function aesKey() {
  return Buffer.from(`${aesKeyText}=`, "base64");
}

function pad32(buffer) {
  const count = 32 - (buffer.length % 32);
  return Buffer.concat([buffer, Buffer.alloc(count, count)]);
}

function encryptPayload(value) {
  const content = Buffer.from(value);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(content.length);
  const plain = pad32(Buffer.concat([crypto.randomBytes(16), length, content, Buffer.from(appId)]));
  const key = aesKey();
  const cipher = crypto.createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64");
}

function decryptPayload(encrypted) {
  const key = aesKey();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  let plain = Buffer.concat([decipher.update(encrypted, "base64"), decipher.final()]);
  plain = plain.subarray(0, plain.length - plain[plain.length - 1]);
  const length = plain.readUInt32BE(16);
  return plain.subarray(20, 20 + length).toString("utf8");
}

function tag(xmlText, name) {
  const found = xmlText.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${name}>`));
  return (found?.[1] ?? found?.[2] ?? "").trim();
}

function query() {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(6).toString("hex");
  return { timestamp, nonce, signature: signature(timestamp, nonce) };
}

function xml(content, msgId) {
  return `<xml><ToUserName><![CDATA[gh_local_test]]></ToUserName><FromUserName><![CDATA[openid_local_test]]></FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${content}]]></Content><MsgId>${msgId}</MsgId></xml>`;
}

function subscribeXml() {
  return `<xml><ToUserName><![CDATA[gh_local_test]]></ToUserName><FromUserName><![CDATA[openid_subscribe_test]]></FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[subscribe]]></Event></xml>`;
}

async function verifyUrl() {
  const params = new URLSearchParams({ ...query(), echostr: "dimmo-ok" });
  const response = await fetch(`${baseUrl}?${params}`);
  const body = await response.text();
  if (!response.ok || body !== "dimmo-ok") throw new Error(`URL 验证失败 (${response.status}): ${body}`);
  console.log("✓ 微信 URL 验证通过");
}

async function message(content, msgId) {
  const params = new URLSearchParams(query());
  const response = await fetch(`${baseUrl}?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml(content, msgId)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`消息请求失败 (${response.status}): ${body}`);
  return body;
}

async function subscribe() {
  const params = new URLSearchParams(query());
  const response = await fetch(`${baseUrl}?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: subscribeXml()
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`关注事件请求失败 (${response.status}): ${body}`);
  return body;
}

async function encryptedMessage(content, msgId) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(6).toString("hex");
  const encrypted = encryptPayload(xml(content, msgId));
  const params = new URLSearchParams({ timestamp, nonce, encrypt_type: "aes", msg_signature: messageSignature(timestamp, nonce, encrypted) });
  const response = await fetch(`${baseUrl}?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: `<xml><ToUserName><![CDATA[gh_local_test]]></ToUserName><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`AES 消息请求失败 (${response.status}): ${body}`);
  const replyEncrypted = tag(body, "Encrypt");
  if (!replyEncrypted) throw new Error(`AES 回复缺少 Encrypt：${body}`);
  return decryptPayload(replyEncrypted);
}

await verifyUrl();

const welcome = await subscribe();
if (!/嗨，我是 Dimmo/.test(welcome) || !/喵喵工作台/.test(welcome)) {
  throw new Error(`关注欢迎语不符合预期：${welcome}`);
}
console.log("✓ 关注事件返回 Dimmo 欢迎语");

const suffix = Date.now();
const reception = await message("你好", `local-reception-${suffix}`);
if (!/Dimmo|咪|社长/.test(reception) || /具体党务判断/.test(reception)) {
  throw new Error(`普通接待链路不符合预期：${reception}`);
}
console.log("✓ 普通问题由 Dimmo 直接回复");

const casualChat = await message("你在干嘛", `local-casual-chat-${suffix}`);
if (!/咪|Dimmo/.test(casualChat) || /交给小宣社长确认|专业判断/.test(casualChat)) {
  throw new Error(`日常闲聊被误转人工：${casualChat}`);
}
console.log("✓ 日常闲聊不会误转小宣");

const resource = await message("有没有主题党日模板？", `local-resource-${suffix}`);
if (!/主题党日|xiaoxuanvip\.com\/materials/.test(resource) || /交给小宣社长确认/.test(resource)) {
  throw new Error(`资料检索链路不符合预期：${resource}`);
}
console.log("✓ 找资料命中资料库后返回明确结果");

const tool = await message("帮我算一下积极分子什么时候满一年", `local-tool-${suffix}`);
if (!/入党时间核算/.test(tool) || /交给小宣社长确认/.test(tool)) {
  throw new Error(`工具路由链路不符合预期：${tool}`);
}
console.log("✓ 工具问题进入入党时间核算，不由 Dimmo 手算");

const human = await message("我要找小宣", `local-human-${suffix}`);
if (!/交给小宣社长确认/.test(human)) {
  throw new Error(`人工转交链路不符合预期：${human}`);
}
console.log("✓ 明确找小宣的问题已转人工");

const professional = await message("支委会可以研究接收预备党员吗？", `local-professional-${suffix}`);
if (!/党务判断|小宣社长|社长.*回复/.test(professional)) {
  throw new Error(`专业问题没有转交小宣：${professional}`);
}
console.log("✓ 专业问题被硬规则拦截并转交小宣");

if (aesKeyText && appId) {
  const aesReply = await encryptedMessage("你好", `local-aes-${suffix}`);
  if (!/Dimmo|咪|社长/.test(aesReply) || /具体党务判断/.test(aesReply)) throw new Error(`AES 回复不符合预期：${aesReply}`);
  console.log("✓ AES 安全模式消息接收、解密与加密回复通过");
}

console.log("\n工作小猫两条主链路测试通过。请再到 /admin/work-cat 检查待回复记录与上下文。");
