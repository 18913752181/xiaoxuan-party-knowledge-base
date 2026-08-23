"use client";

import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { maskAccountEmail } from "@/lib/display";

type Plan = { code: "monthly" | "quarterly" | "annual"; name: string; duration: string; amountTotal: number };

const MAX_POLL_COUNT = 120; // 最多轮询 120 次 × 3 秒 = 6 分钟（覆盖微信支付 2 小时有效期足够）
const POLL_INTERVAL = 3000;
const REDIRECT_DELAY = 2500;

type BridgeResult = { err_msg?: string };
type WechatBridge = {
  invoke: (name: string, params: Record<string, string>, callback: (result: BridgeResult) => void) => void;
};

/** 调起微信内置收银台（仅微信内置浏览器可用） */
function invokeWechatCashier(payParams: Record<string, string>, onResult: (errMsg: string) => void) {
  const run = () => {
    const bridge = (window as unknown as { WeixinJSBridge?: WechatBridge }).WeixinJSBridge;
    if (!bridge) {
      onResult("unavailable");
      return;
    }
    bridge.invoke("getBrandWCPayRequest", payParams, (result) => onResult(result?.err_msg || ""));
  };
  if ((window as unknown as { WeixinJSBridge?: unknown }).WeixinJSBridge) run();
  else document.addEventListener("WeixinJSBridgeReady", run, { once: true });
}

export default function MembershipPaymentPage() {
  const router = useRouter();
  const { profile, loading, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState<Plan["code"]>("annual");
  const [configured, setConfigured] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [qrCode, setQrCode] = useState("");
  // 服务端二维码接口输出真实 PNG 图片地址（可长按保存/识别，兼容性优于 data URL），加载失败时回退到 data URL
  const [qrSrc, setQrSrc] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "paying" | "paid">("idle");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState("");
  // 手机端（尤其微信内）无法直接扫描屏幕上的二维码，且微信已限制长按识别 weixin:// 支付链接，
  // 需要在客户端识别设备类型后展示"截图 → 扫一扫相册识别"的指引
  const [isMobile, setIsMobile] = useState(false);
  const [inWechat, setInWechat] = useState(false);
  const [jsapiReady, setJsapiReady] = useState(false);
  const pollCountRef = useRef(0);
  const autoPayRef = useRef(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsMobile(/Android|iPhone|iPad|Mobile/i.test(ua));
    setInWechat(/MicroMessenger/i.test(ua));
  }, []);

  useEffect(() => {
    fetch("/api/membership/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setConfigured(Boolean(data.configured));
        setJsapiReady(Boolean(data.jsapiConfigured));
        const nextPlans = Array.isArray(data.plans) ? data.plans as Plan[] : [];
        setPlans(nextPlans);
        if (!nextPlans.some((plan) => plan.code === "annual") && nextPlans[0]) setSelectedPlanCode(nextPlans[0].code);
      })
      .catch(() => setMessage("会员信息读取失败，请稍后重试。"));
  }, []);

  // 微信授权回跳处理：jsapi=auto 自动唤起收银台；jsapi=error 展示失败原因
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jsapi = params.get("jsapi");
    if (!jsapi) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (jsapi === "error") {
      setMessage(params.get("reason") || "微信授权失败，请重试。");
    } else if (jsapi === "auto") {
      autoPayRef.current = true;
    }
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
    const response = await fetch("/api/payments/wechat/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode: selectedPlanCode })
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus("idle");
      setMessage(data.error || "创建订单失败。");
      return;
    }
    setOrderNo(data.outTradeNo);
    setQrCode(await QRCode.toDataURL(data.codeUrl, { width: 280, margin: 1, errorCorrectionLevel: "M" }));
    setQrSrc(`/api/payments/wechat/qrcode?url=${encodeURIComponent(data.codeUrl)}`);
    setStatus("paying");
  }

  // 微信内 JSAPI 支付：静默授权获取 openid → 下单 → 唤起微信收银台
  const startJsapiPay = useCallback(async () => {
    setStatus("creating");
    setMessage("");
    try {
      const response = await fetch("/api/payments/wechat/jsapi/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: selectedPlanCode })
      });
      const data = await response.json();
      if (response.status === 401 && data.needOAuth) {
        // 跳转微信静默授权，完成后携 jsapi=auto 回到本页自动唤起收银台
        window.location.href = "/api/payments/wechat/oauth";
        return;
      }
      if (!response.ok) {
        setStatus("idle");
        setMessage(data.error || "创建订单失败。");
        return;
      }
      setOrderNo(data.outTradeNo);
      invokeWechatCashier(data.payParams, (errMsg) => {
        if (errMsg === "get_brand_wcpay_request:ok") {
          setStatus("paying");
          setMessage("正在确认支付结果…");
        } else if (errMsg.includes("cancel")) {
          setStatus("idle");
          setMessage("已取消支付，如仍需开通会员请重新点击微信支付。");
        } else {
          setStatus("idle");
          // 临时透出微信返回的原始错误，便于定位唤起失败原因
          setMessage(`收银台唤起失败，请重试。（${errMsg || "无错误详情"}）`);
        }
      });
    } catch {
      setStatus("idle");
      setMessage("网络异常，请稍后重试。");
    }
  }, [selectedPlanCode]);

  // 授权回跳后，等待登录态与支付配置就绪再自动唤起收银台
  useEffect(() => {
    if (!autoPayRef.current || loading || !profile || !jsapiReady) return;
    autoPayRef.current = false;
    void startJsapiPay();
  }, [loading, profile, jsapiReady, startJsapiPay]);

  const useJsapi = inWechat && jsapiReady;

  const plan = plans.find((candidate) => candidate.code === selectedPlanCode) || null;
  const price = plan ? (plan.amountTotal / 100).toFixed(0) : "--";

  return (
    <main className="min-h-[100dvh] bg-[#f6f5ef] px-4 py-6 text-[#24372e] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/library" className="text-sm font-medium text-[#587063]">返回资料库</Link>
        <section className="mt-4 overflow-hidden rounded-[28px] border border-[#d9dfd4] bg-white shadow-[0_20px_60px_rgba(36,55,46,0.08)]">
          <header className="relative overflow-hidden bg-[#eaf0ea] px-6 py-8 sm:px-10 sm:py-10">
            <Image src="/images/dimmo-resting-transparent-v2.png" alt="Dimmo 工作小猫" width={240} height={240} priority className="pointer-events-none absolute -bottom-7 right-3 h-36 w-auto opacity-95 sm:right-10 sm:h-44" />
            <p className="text-sm font-semibold tracking-wide text-[#9b4d48]">小宣干货社年度会员</p>
            <h1 className="mt-3 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">资料有归处，工作也有人陪着记。</h1>
            <p className="mt-4 max-w-lg pr-24 text-sm leading-7 text-[#587063] sm:text-base">一份会员，包含资料库完整权益，也包含 Dimmo 的任务小本本、提醒与非专业工作陪伴。</p>
          </header>
          <div className="grid gap-7 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_330px] md:p-10">
            <div>
              <h2 className="text-xl font-semibold">选一张适合现在的卡</h2>
              <div className="mt-5 grid gap-3">
                {plans.map((candidate) => {
                  const selected = candidate.code === selectedPlanCode;
                  return <button key={candidate.code} type="button" onClick={() => setSelectedPlanCode(candidate.code)} className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition active:scale-[0.99] ${selected ? "border-[#9b4d48] bg-[#fbf2ef] ring-1 ring-[#9b4d48]" : "border-[#dce2dc] bg-white hover:border-[#aebcb0]"}`}>
                    <span><span className="block text-base font-semibold">{candidate.name} · {candidate.duration}</span><span className="mt-1 block text-sm text-[#718277]">资料库 + Dimmo 工作台</span></span>
                    <span className={`text-2xl font-semibold ${selected ? "text-[#9b4d48]" : "text-[#24372e]"}`}>¥{(candidate.amountTotal / 100).toFixed(0)}</span>
                  </button>;
                })}
              </div>
              <div className="mt-7 rounded-2xl bg-[#f3f6f2] p-5 text-sm leading-7 text-[#52675b]">
                <p className="font-semibold text-[#24372e]">会员包含</p>
                <ul className="mt-2 space-y-1"><li>完整会员资料与后续更新</li><li>Dimmo 任务小本本与提醒</li><li>非专业内容的 AI 陪伴与资料导航</li></ul>
              </div>
              <p className="mt-4 text-xs leading-6 text-[#718277]">已开通的资料库会员可直接使用 Dimmo 会员权益，无需重复付费。涉及具体党务判断的问题仍由小宣社长处理。</p>
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
                  {profile.member_status === "member" &&
                  profile.member_expires_at &&
                  profile.member_expires_at >= new Date().toISOString().slice(0, 10) ? (
                    <div className="mb-4 rounded-xl bg-[#c79b52]/10 px-4 py-3 text-center ring-1 ring-[#c79b52]/40">
                      <p className="text-sm font-semibold text-[#8a6b50]">★ 当前已是会员</p>
                  <p className="mt-1 text-xs text-[#a08d72]">有效期至 {profile.member_expires_at}，续费会在当前有效期后顺延</p>
                    </div>
                  ) : null}
                  <p className="text-sm text-neutral-500">当前账号：{maskAccountEmail(profile.email)}</p>
                  <p className="mt-6 text-sm text-neutral-500">已选：{plan ? `${plan.name} · ${plan.duration}` : "正在读取套餐"}</p>
                  <p className="mt-2 text-4xl font-semibold text-[#9b4d48]">¥ {price}</p>
                  <button
                    disabled={!configured}
                    onClick={() => {
                      if (useJsapi) void startJsapiPay();
                      else void createOrder();
                    }}
                    className="mt-8 w-full rounded-xl bg-[#24372e] px-5 py-3 text-sm font-medium text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    {configured ? `开通${plan?.name || "会员"}` : "支付功能待配置"}
                  </button>
                  {configured && useJsapi ? (
                    <p className="mt-3 text-xs leading-5 text-neutral-400">微信内直接唤起收银台，无需扫码</p>
                  ) : null}
                  {!configured ? (
                    <p className="mt-3 text-xs leading-5 text-neutral-400">
                      微信支付配置尚未完成，暂无法在线开通会员，请稍后再试或联系站长。
                    </p>
                  ) : null}
                </>
              ) : null}
              {status === "creating" ? <p className="py-24 text-sm text-neutral-500">正在生成微信支付订单…</p> : null}
              {status === "paying" && !qrSrc ? (
                <div className="py-20">
                  <p className="text-sm font-medium">正在确认支付结果…</p>
                  <p className="mt-2 text-xs text-neutral-500">如已在微信收银台完成支付，页面会自动开通会员，请勿关闭。</p>
                  <p className="mt-2 break-all text-xs text-neutral-400">订单号：{orderNo}</p>
                </div>
              ) : null}
              {status === "paying" && qrSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 支付二维码为动态生成内容，next/image 无法优化 */}
                  <img
                    src={qrSrc}
                    onError={() => {
                      if (qrSrc !== qrCode) setQrSrc(qrCode);
                    }}
                    alt="微信支付二维码"
                    className="mx-auto h-64 w-64 rounded-xl bg-white p-2"
                  />
                  <p className="mt-4 text-sm font-medium">请使用微信「扫一扫」完成支付</p>
                  {isMobile ? (
                    <div className="mt-3 rounded-xl bg-[#fdf3f0] p-4 text-left text-xs leading-6 text-[#8a5340]">
                      {inWechat ? (
                        <p className="font-medium">微信已限制长按识别支付链接，请按以下步骤支付：</p>
                      ) : (
                        <p className="font-medium">手机端请按以下步骤支付：</p>
                      )}
                      <ol className="mt-2 list-decimal space-y-1 pl-4">
                        <li>截取当前屏幕，保存本页二维码</li>
                        <li>打开微信「扫一扫」，点击右下角「相册」</li>
                        <li>选择刚截取的图片，识别后完成支付</li>
                      </ol>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-neutral-500">用手机微信扫描上方二维码即可支付</p>
                  )}
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
