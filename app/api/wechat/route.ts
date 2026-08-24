import { handleWorkCatMessage } from "@/lib/work-cat/handler";
import { sendCustomerServiceText, sendCustomerServiceTyping } from "@/lib/work-cat/wechat-customer-service";
import {
  buildEncryptedReply,
  buildTextReply,
  decryptWechatMessage,
  parseWechatMessage,
  verifyMessageSignature,
  verifyPlainSignature,
  xmlValue
} from "@/lib/work-cat/wechat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIBE_REPLY = `嗨，我是 Dimmo，和我们社长住在「喵喵工作台」的小猫。

🐾【喵喵工作台】
初次见面，咪先做介绍👉 https://xiaoxuanvip.com/dimmo
立即开通，获得通行卡👉https://xiaoxuanvip.com/membership/payment

📚【资料库】
喵喵资料库｜工作资料、模板、专题内容
👉 https://xiaoxuanvip.com/

🧰【工具箱】
喵喵小程序｜入党时间核算、红色教育基地导览
👉 小程序正在准备中

🌱 咪还在慢慢长大。
涉及具体党务判断的问题，咪会认真收进小本本，交给小宣社长回复。
需要时随时叫咪，咪一直住在这里喵～`;

function config() {
  return {
    token: process.env.WECHAT_TOKEN || "",
    appId: process.env.WECHAT_OFFICIAL_APP_ID || process.env.WECHAT_APP_ID || "",
    aesKey: process.env.WECHAT_ENCODING_AES_KEY || "",
    appSecret: process.env.WECHAT_OFFICIAL_APP_SECRET || ""
  };
}

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const { token, appId, aesKey } = config();
  if (!token) return text("WECHAT_TOKEN is not configured", 503);
  const url = new URL(request.url);
  const signature = url.searchParams.get("signature") || "";
  const msgSignature = url.searchParams.get("msg_signature") || "";
  const timestamp = url.searchParams.get("timestamp") || "";
  const nonce = url.searchParams.get("nonce") || "";
  const echo = url.searchParams.get("echostr") || "";

  if (msgSignature) {
    if (!aesKey || !appId || !verifyMessageSignature(token, timestamp, nonce, echo, msgSignature)) return text("invalid signature", 403);
    try { return text(decryptWechatMessage(echo, aesKey, appId)); } catch { return text("invalid echostr", 403); }
  }
  return verifyPlainSignature(token, timestamp, nonce, signature) ? text(echo) : text("invalid signature", 403);
}

export async function POST(request: Request) {
  const { token, appId, aesKey, appSecret } = config();
  if (!token) return text("success");
  const url = new URL(request.url);
  const timestamp = url.searchParams.get("timestamp") || "";
  const nonce = url.searchParams.get("nonce") || "";
  const signature = url.searchParams.get("signature") || "";
  const msgSignature = url.searchParams.get("msg_signature") || "";
  const encryptedMode = url.searchParams.get("encrypt_type") === "aes" || Boolean(msgSignature);
  const outerXml = await request.text();

  let messageXml = outerXml;
  if (encryptedMode) {
    const encrypted = xmlValue(outerXml, "Encrypt");
    if (!aesKey || !appId || !encrypted || !verifyMessageSignature(token, timestamp, nonce, encrypted, msgSignature)) return text("invalid signature", 403);
    try { messageXml = decryptWechatMessage(encrypted, aesKey, appId); } catch { return text("invalid message", 400); }
  } else if (!verifyPlainSignature(token, timestamp, nonce, signature)) {
    return text("invalid signature", 403);
  }

  const message = parseWechatMessage(messageXml);
  if (!message.FromUserName) return text("success");

  if (message.MsgType === "event" && message.Event.toLowerCase() === "subscribe") {
    const replyXml = buildTextReply(message.FromUserName, message.ToUserName, SUBSCRIBE_REPLY);
    return text(encryptedMode ? buildEncryptedReply(replyXml, token, aesKey, appId) : replyXml);
  }

  if (message.MsgType !== "text") return text("success");

  // 先请求微信客户端展示原生“正在输入”。不具备客服接口权限时继续走被动回复，
  // 同时开始消息处理，避免 AI 改写与微信接口串行后超过被动回复窗口。
  const typingStartedAt = Date.now();
  const [typingEnabled, result] = await Promise.all([
    sendCustomerServiceTyping(message.FromUserName, appId, appSecret),
    handleWorkCatMessage({ openid: message.FromUserName, content: message.Content, msgId: message.MsgId })
  ]);
  if (!result.reply) return text("success");

  if (typingEnabled) {
    // 避免回复快到输入状态不可感知，同时控制在微信被动请求超时窗口内。
    const remainingDelay = Math.max(0, 700 - (Date.now() - typingStartedAt));
    if (remainingDelay) await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    const sent = await sendCustomerServiceText(message.FromUserName, result.reply, appId, appSecret);
    if (sent) return text("success");
  }

  // 客服输入状态/消息接口不可用时，保留原有被动 XML 回复作为可靠兜底。
  const replyXml = buildTextReply(message.FromUserName, message.ToUserName, result.reply);
  return text(encryptedMode ? buildEncryptedReply(replyXml, token, aesKey, appId) : replyXml);
}
