"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const PRESET_AMOUNTS = [3, 6, 10, 20];

type QrState = { codeUrl: string; outTradeNo: string; amountCents: number };

function SupportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceSlug = searchParams.get("from") || "";
  const sourceTitle = searchParams.get("title") || "";

  const [selected, setSelected] = useState<number | null>(6);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const [qr, setQr] = useState<QrState | null>(null);
  const [paid, setPaid] = useState(false);

  const amount = customAmount ? Number(customAmount) : selected;

  // 扫码后轮询支付状态（服务端会主动向微信查单，付完即时生效）
  useEffect(() => {
    if (!qr || paid) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/donations/status?outTradeNo=${encodeURIComponent(qr.outTradeNo)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.status === "paid") setPaid(true);
      } catch {
        // 下一次轮询再试
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [qr, paid]);

  async function submit() {
    if (!amount || !Number.isFinite(amount) || amount < 1 || amount > 2000) {
      setMessage("请选择或输入 1-2000 元之间的金额。");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(amount * 100),
          sourceSlug,
          sourceTitle
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(`/support?from=${sourceSlug}&title=${sourceTitle}`)}`);
        return;
      }
      if (!response.ok) {
        setMessage(data.error || "提交失败，请稍后再试。");
        return;
      }
      if (data.configured === false) {
        setUnconfigured(true);
        return;
      }
      setQr({ codeUrl: data.codeUrl, outTradeNo: data.outTradeNo, amountCents: data.amountCents });
    } catch {
      setMessage("网络异常，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-5 py-12 lg:px-8">
      <div className="rounded-[2rem] border border-[#ead9c2] bg-white p-8 shadow-soft">
        <p className="text-sm font-medium text-[#c98a4b]">自愿赞赏</p>
        <h1 className="mt-2 text-3xl font-semibold text-brand-ink">支持小宣 ☕️</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-500">
          你的每一份支持，都会用于持续整理资料、完善工具和更新网站。
        </p>
        {sourceTitle ? (
          <p className="mt-2 text-xs text-neutral-400">来自资料：{sourceTitle}</p>
        ) : null}

        {paid ? (
          <div className="mt-6 rounded-2xl bg-[#fdf9f2] px-5 py-6 text-center">
            <p className="text-base font-medium text-[#7a5c3a]">已收到你的支持，谢谢你 ❤️</p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">小宣会继续整理更多实用内容。</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-[#c98a4b] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#b67a3e]">
              返回首页
            </Link>
          </div>
        ) : qr ? (
          <div className="mt-6 text-center">
            <p className="text-base font-medium text-[#7a5c3a]">微信扫一扫，完成 {(qr.amountCents / 100).toFixed(2)} 元自愿赞赏</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/payments/wechat/qrcode?url=${encodeURIComponent(qr.codeUrl)}`}
              alt="微信支付二维码"
              className="mx-auto mt-4 h-56 w-56 rounded-2xl border border-[#ead9c2]"
            />
            <p className="mt-3 text-xs leading-6 text-neutral-400">
              手机上可长按二维码识别支付；支付成功后页面会自动确认。
            </p>
            <button
              type="button"
              onClick={() => setQr(null)}
              className="mt-4 rounded-xl px-4 py-2 text-sm text-[#a08d72] transition hover:bg-[#f3ece0]"
            >
              返回修改金额
            </button>
          </div>
        ) : unconfigured ? (
          <div className="mt-6 rounded-2xl bg-[#fdf9f2] px-5 py-6 text-center">
            <p className="text-base font-medium text-[#7a5c3a]">心意收到啦，谢谢你的支持 ❤️</p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              赞赏支付通道正在配置中，本次未产生任何费用。等通道开放后再来也不迟～
            </p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-[#c98a4b] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#b67a3e]">
              返回首页
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-4 gap-3">
              {PRESET_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSelected(value);
                    setCustomAmount("");
                  }}
                  className={`rounded-2xl border px-3 py-3 text-base font-medium transition ${
                    selected === value && !customAmount
                      ? "border-[#c98a4b] bg-[#fdf3e5] text-[#a06a2f]"
                      : "border-[#ead9c2] text-neutral-600 hover:border-[#d9b98f]"
                  }`}
                >
                  {value} 元
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={2000}
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              placeholder="自定义金额（1-2000 元）"
              className="mt-3 w-full rounded-2xl border border-[#ead9c2] px-4 py-3 text-sm outline-none transition focus:border-[#c98a4b]"
            />

            <p className="mt-4 text-xs leading-6 text-neutral-400">
              赞赏为自愿支持，不购买任何额外权益；资料下载、查看与会员权益不受任何影响。
            </p>

            {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-5 w-full rounded-2xl bg-[#c98a4b] py-3 text-base font-medium text-white transition hover:bg-[#b67a3e] disabled:opacity-60"
            >
              {submitting ? "正在生成支付二维码…" : `自愿支持 ${amount || ""} 元`}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-xl px-5 py-12 text-neutral-400">加载中…</section>}>
      <SupportPageInner />
    </Suspense>
  );
}
