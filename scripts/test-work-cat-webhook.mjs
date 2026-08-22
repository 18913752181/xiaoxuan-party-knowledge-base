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

const suffix = Date.now();
const reception = await message("你好", `local-reception-${suffix}`);
if (!/Dimmo|咪|社长/.test(reception) || /具体党务判断/.test(reception)) {
  throw new Error(`普通接待链路不符合预期：${reception}`);
}
console.log("✓ 普通问题由 Dimmo 直接回复");

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
