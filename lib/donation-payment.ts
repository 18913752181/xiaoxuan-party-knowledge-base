import "server-only";

/**
 * 赞赏支付配置模块（占位实现）。
 *
 * 现阶段赞赏为自愿功能，正式支付通道尚未接入。
 * 后续接入企业微信支付/公司商户号时：
 *   1. 在环境变量中设置 DONATION_PAYMENT_PROVIDER=wechat
 *   2. 在下方 createDonationPayment 中复用 lib/wechat-pay.ts 的下单逻辑
 *   3. 在回调里把 public.donations 的 status 置为 paid
 * 不需要改动任何页面组件。
 */

export type DonationPaymentResult =
  | { configured: false }
  | { configured: true; outTradeNo: string; paymentParams: Record<string, unknown> };

export function donationPaymentProvider() {
  return (process.env.DONATION_PAYMENT_PROVIDER || "").trim();
}

export function donationPaymentConfigured() {
  return donationPaymentProvider().length > 0;
}

export async function createDonationPayment(input: {
  donationId: string;
  amountCents: number;
  userId: string;
  openId?: string;
}): Promise<DonationPaymentResult> {
  void input;
  if (!donationPaymentConfigured()) return { configured: false };

  // TODO: 接入正式支付通道后在这里创建支付单并返回拉起支付的参数。
  // 会员支付的实现（lib/wechat-pay.ts + app/api/payments/wechat/*）可直接复用。
  return { configured: false };
}
