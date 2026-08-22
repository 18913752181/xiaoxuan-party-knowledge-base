import "server-only";

import crypto from "crypto";

export type WechatMessage = {
  ToUserName: string;
  FromUserName: string;
  CreateTime: string;
  MsgType: string;
  Content: string;
  MsgId: string;
  Event: string;
  EventKey: string;
  Encrypt?: string;
};

function sha1(parts: string[]) {
  return crypto.createHash("sha1").update(parts.sort().join("")).digest("hex");
}

export function verifyPlainSignature(token: string, timestamp: string, nonce: string, signature: string) {
  const expected = sha1([token, timestamp, nonce]);
  return Boolean(token && signature) && expected.length === signature.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyMessageSignature(token: string, timestamp: string, nonce: string, encrypted: string, signature: string) {
  const expected = sha1([token, timestamp, nonce, encrypted]);
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
}

export function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i"));
  return decodeXml((match?.[1] ?? match?.[2] ?? "").trim());
}

export function parseWechatMessage(xml: string): WechatMessage {
  return {
    ToUserName: xmlValue(xml, "ToUserName"),
    FromUserName: xmlValue(xml, "FromUserName"),
    CreateTime: xmlValue(xml, "CreateTime"),
    MsgType: xmlValue(xml, "MsgType"),
    Content: xmlValue(xml, "Content"),
    MsgId: xmlValue(xml, "MsgId"),
    Event: xmlValue(xml, "Event"),
    EventKey: xmlValue(xml, "EventKey"),
    Encrypt: xmlValue(xml, "Encrypt") || undefined
  };
}

function aesKey(encodingAesKey: string) {
  const key = Buffer.from(`${encodingAesKey}=`, "base64");
  if (key.length !== 32) throw new Error("WECHAT_ENCODING_AES_KEY 必须是 43 位字符。");
  return key;
}

function pkcs7Pad(buffer: Buffer) {
  const blockSize = 32;
  const pad = blockSize - (buffer.length % blockSize);
  return Buffer.concat([buffer, Buffer.alloc(pad, pad)]);
}

function pkcs7Unpad(buffer: Buffer) {
  const pad = buffer[buffer.length - 1];
  if (!pad || pad > 32) throw new Error("微信消息填充无效。");
  for (let index = buffer.length - pad; index < buffer.length; index += 1) {
    if (buffer[index] !== pad) throw new Error("微信消息填充无效。");
  }
  return buffer.subarray(0, buffer.length - pad);
}

export function decryptWechatMessage(encrypted: string, encodingAesKey: string, appId: string) {
  const key = aesKey(encodingAesKey);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const plain = pkcs7Unpad(Buffer.concat([decipher.update(encrypted, "base64"), decipher.final()]));
  if (plain.length < 20) throw new Error("微信消息长度无效。");
  const length = plain.readUInt32BE(16);
  if (length <= 0 || 20 + length > plain.length) throw new Error("微信消息长度无效。");
  const xml = plain.subarray(20, 20 + length).toString("utf8");
  const receivedAppId = plain.subarray(20 + length).toString("utf8");
  if (receivedAppId !== appId) throw new Error("微信消息 AppID 不匹配。");
  return xml;
}

export function encryptWechatMessage(xml: string, encodingAesKey: string, appId: string) {
  const key = aesKey(encodingAesKey);
  const xmlBuffer = Buffer.from(xml);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(xmlBuffer.length);
  const plain = pkcs7Pad(Buffer.concat([crypto.randomBytes(16), length, xmlBuffer, Buffer.from(appId)]));
  const cipher = crypto.createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64");
}

function cdata(value: string) {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export function buildTextReply(toUser: string, fromUser: string, content: string) {
  return `<xml><ToUserName>${cdata(toUser)}</ToUserName><FromUserName>${cdata(fromUser)}</FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content>${cdata(content)}</Content></xml>`;
}

export function buildEncryptedReply(xml: string, token: string, encodingAesKey: string, appId: string) {
  const encrypted = encryptWechatMessage(xml, encodingAesKey, appId);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(8).toString("hex");
  const signature = sha1([token, timestamp, nonce, encrypted]);
  return `<xml><Encrypt>${cdata(encrypted)}</Encrypt><MsgSignature>${cdata(signature)}</MsgSignature><TimeStamp>${timestamp}</TimeStamp><Nonce>${cdata(nonce)}</Nonce></xml>`;
}
