"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Plan = { name: string; duration: string; amountTotal: number };

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
    bridge.invoke("getBrandPayRequest", payParams, (result) => onResult(result?.err_msg || ""));
  };
  if ((window as unknown as { WeixinJSBridge?: unknown }).WeixinJSBridge) run();
  else document.addEventListener("WeixinJSBridgeReady", run, { once: true });
}

export default function MembershipPaymentPage() {
  const router = useRouter();
  const { profile, loading, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
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
        setPlan(data.plan);
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
    const response = await fetch("/api/payments/wechat/orders", { method: "POST" });
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
      const response = await fetch("/api/payments/wechat/jsapi/orders", { method: "POST" });
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
        if (errMsg === "get_brand_pay_request:ok") {
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
  }, []);

  // 授权回跳后，等待登录态与支付配置就绪再自动唤起收银台
  useEffect(() => {
    if (!autoPayRef.current || loading || !profile || !jsapiReady) return;
    autoPayRef.current = false;
    void startJsapiPay();
  }, [loading, profile, jsapiReady, startJsapiPay]);

  const useJsapi = inWechat && jsapiReady;

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
                  {profile.member_status === "member" &&
                  profile.member_expires_at &&
                  profile.member_expires_at >= new Date().toISOString().slice(0, 10) ? (
                    <div className="mb-4 rounded-xl bg-[#c79b52]/10 px-4 py-3 text-center ring-1 ring-[#c79b52]/40">
                      <p className="text-sm font-semibold text-[#8a6b50]">★ 当前已是会员</p>
                      <p className="mt-1 text-xs text-[#a08d72]">有效期至 {profile.member_expires_at}，再次支付将顺延一年</p>
                    </div>
                  ) : null}
                  <p className="text-sm text-neutral-500">当前账号：{profile.email}</p>
                  <button
                    disabled={!configured}
                    onClick={() => {
                      if (useJsapi) void startJsapiPay();
                      else void createOrder();
                    }}
                    className="mt-8 w-full rounded-xl bg-[#a64550] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    {configured ? "微信支付" : "支付功能待配置"}
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
