import "server-only";

import crypto from "crypto";
import { createNativeOrder, wechatPayConfigured } from "@/lib/wechat-pay";

/**
 * 赞赏支付通道模块。
 *
 * 当前实现：微信支付 Native（扫码），复用会员支付的商户配置。
 * 开关：环境变量 DONATION_PAYMENT_PROVIDER=wechat。
 * 回调入口：/api/donations/notify（独立于会员回调）。
 * 后续若要换企业微信支付/其他商户号，只需改这一个文件。
 */

export type DonationPaymentResult =
  | { configured: false }
  | { configured: true; outTradeNo: string; codeUrl: string };

export function donationPaymentProvider() {
  return (process.env.DONATION_PAYMENT_PROVIDER || "").trim();
}

export function donationPaymentConfigured() {
  return donationPaymentProvider() === "wechat" && wechatPayConfigured();
}

export function newDonationOutTradeNo() {
  return `DON${Date.now()}${crypto.randomBytes(5).toString("hex").toUpperCase()}`.slice(0, 32);
}

export async function createDonationPayment(input: {
  outTradeNo: string;
  amountCents: number;
}): Promise<DonationPaymentResult> {
  if (!donationPaymentConfigured()) return { configured: false };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const codeUrl = await createNativeOrder({
    outTradeNo: input.outTradeNo,
    description: "支持小宣自愿赞赏",
    amountTotal: input.amountCents,
    notifyUrl: siteUrl ? `${siteUrl}/api/donations/notify` : undefined
  });
  return { configured: true, outTradeNo: input.outTradeNo, codeUrl };
}
