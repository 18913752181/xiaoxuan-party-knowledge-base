"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Plan = { name: string; duration: string; amountTotal: number };

const MAX_POLL_COUNT = 120; // 最多轮询 120 次 × 3 秒 = 6 分钟（覆盖微信支付 2 小时有效期足够）
const POLL_INTERVAL = 3000;
const REDIRECT_DELAY = 2500;

export default function MembershipPaymentPage() {
  const router = useRouter();
  const { profile, loading, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [configured, setConfigured] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "paying" | "paid">("idle");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState("");
  const pollCountRef = useRef(0);

  useEffect(() => {
    fetch("/api/membership/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setPlan(data.plan);
      })
      .catch(() => setMessage("会员信息读取失败，请稍后重试。"));
  }, []);

  // 支付成功后自动跳转到资料库
  useEffect(() => {
    if (status !== "paid") return;
    const timer = window.setTimeout(() => {
      router.push("/library");
    }, REDIRECT_DELAY);
    return () => window.clearTimeout(timer);
  }, [status, router]);

  // 轮询订单支付状态
  useEffect(() => {
    if (!orderNo || status !== "paying") return;
    pollCountRef.current = 0;

    const timer = window.setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > MAX_POLL_COUNT) {
        window.clearInterval(timer);
        setMessage("支付确认超时，请刷新页面重试，或联系客服。");
        return;
      }

      try {
        const response = await fetch(
          `/api/payments/orders/${encodeURIComponent(orderNo)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          if (response.status === 401) {
            window.clearInterval(timer);
            setMessage("登录状态已失效，请重新登录后查看订单。");
          }
          return;
        }

        const data = await response.json();
        if (data.order?.status === "paid") {
          window.clearInterval(timer);
          setStatus("paid");
          setExpiry(data.order.member_expires_at || "");
          setMessage("支付成功，会员权益已自动开通。");
          // refreshProfile 失败不应阻塞支付成功状态
          try {
            await refreshProfile();
          } catch {
            // 忽略刷新失败，支付成功状态已设置
          }
        }
      } catch {
        // 网络波动，继续轮询；超过 MAX_POLL_COUNT 会给出提示
      }
    }, POLL_INTERVAL);

    return () => window.clearInterval(timer);
  }, [orderNo, status, refreshProfile]);

  async function createOrder() {
    setStatus("creating");
    setMessage("");
    const response = await fetch("/api/payments/wechat/orders", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setStatus("idle");
      setMessage(data.error || "创建订单失败。");
      return;
    }
    setOrderNo(data.outTradeNo);
    setQrCode(await QRCode.toDataURL(data.codeUrl, { width: 280, margin: 1, errorCorrectionLevel: "M" }));
    setStatus("paying");
  }

  const price = plan ? (plan.amountTotal / 100).toFixed(2) : "--";

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-5 py-10 text-[#303731]">
      <div className="mx-auto max-w-4xl">
        <Link href="/library" className="text-sm text-[#6f8f7e]">返回资料库</Link>
        <section className="mt-5 overflow-hidden rounded-[2rem] border border-[#e5ded2] bg-white shadow-sm">
          <div className="bg-[#f2e9e5] p-7 md:p-10">
            <p className="text-sm font-medium text-[#a64550]">会员支付</p>
            <h1 className="mt-3 text-3xl font-semibold">成为专属会员</h1>
            <p className="mt-3 text-sm leading-7 text-[#6c746f]">开通后可在有效期内下载会员专属资料，支付成功自动生效。</p>
          </div>
          <div className="grid gap-7 p-7 md:grid-cols-[1fr_320px] md:p-10">
            <div>
              <h2 className="text-xl font-semibold">{plan?.name || "小宣资料库年度会员"}</h2>
              <p className="mt-4 text-sm text-neutral-500">有效期：{plan?.duration || "1 年"}</p>
              <p className="mt-6 text-4xl font-semibold text-[#a64550]">¥ {price}</p>
              <ul className="mt-7 space-y-3 text-sm leading-7 text-neutral-600">
                <li>会员专属资料下载权限</li>
                <li>支付成功后自动升级，无需人工审核</li>
                <li>续费将在当前有效期基础上顺延一年</li>
              </ul>
            </div>
            <div className="rounded-3xl bg-[#faf8f3] p-5 text-center ring-1 ring-[#e8e1d6]">
              {loading ? <p className="py-24 text-sm text-neutral-500">正在确认登录状态…</p> : null}
              {!loading && !profile ? (
                <div className="py-20">
                  <p className="text-sm text-neutral-600">请先登录后购买会员</p>
                  <Link href="/login?redirect=/membership/payment" className="mt-5 inline-flex rounded-xl bg-[#a64550] px-6 py-3 text-sm text-white">前往登录</Link>
                </div>
              ) : null}
              {!loading && profile && status === "idle" ? (
                <>
                  <p className="text-sm text-neutral-500">当前账号：{profile.email}</p>
                  <button disabled={!configured} onClick={createOrder} className="mt-8 w-full rounded-xl bg-[#a64550] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300">
                    {configured ? "微信支付" : "支付功能待配置"}
                  </button>
                </>
              ) : null}
              {status === "creating" ? <p className="py-24 text-sm text-neutral-500">正在生成微信支付订单…</p> : null}
              {status === "paying" && qrCode ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 支付二维码为接口动态生成的 data URL，next/image 无法优化 */}
                  <img src={qrCode} alt="微信支付二维码" className="mx-auto h-64 w-64 rounded-xl bg-white p-2" />
                  <p className="mt-4 text-sm font-medium">请使用微信扫一扫完成支付</p>
                  <p className="mt-2 break-all text-xs text-neutral-400">订单号：{orderNo}</p>
                  <p className="mt-3 text-xs text-neutral-500">页面会自动确认支付结果，请勿关闭。</p>
                </>
              ) : null}
              {status === "paid" ? (
                <div className="py-16">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e3efe8] text-2xl text-[#4f7a64]">✓</div>
                  <p className="mt-5 text-lg font-semibold">会员已开通</p>
                  <p className="mt-2 text-sm text-neutral-500">有效期至 {expiry}</p>
                  <p className="mt-3 text-xs text-neutral-400">{REDIRECT_DELAY / 1000} 秒后自动跳转…</p>
                  <Link href="/library" className="mt-4 inline-flex rounded-xl bg-[#a64550] px-6 py-3 text-sm text-white">去下载资料</Link>
                </div>
              ) : null}
              {message ? <p className="mt-4 text-sm leading-6 text-[#a64550]">{message}</p> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
