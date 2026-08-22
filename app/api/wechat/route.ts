import { handleWorkCatMessage } from "@/lib/work-cat/handler";
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

function config() {
  return {
    token: process.env.WECHAT_TOKEN || "",
    appId: process.env.WECHAT_OFFICIAL_APP_ID || process.env.WECHAT_APP_ID || "",
    aesKey: process.env.WECHAT_ENCODING_AES_KEY || ""
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
  const { token, appId, aesKey } = config();
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
  if (!message.FromUserName || message.MsgType !== "text") return text("success");
  const result = await handleWorkCatMessage({ openid: message.FromUserName, content: message.Content, msgId: message.MsgId });
  if (!result.reply) return text("success");

  const replyXml = buildTextReply(message.FromUserName, message.ToUserName, result.reply);
  return text(encryptedMode ? buildEncryptedReply(replyXml, token, aesKey, appId) : replyXml);
}
