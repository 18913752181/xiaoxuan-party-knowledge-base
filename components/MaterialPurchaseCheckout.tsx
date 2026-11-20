
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { downloadMaterialFile, isAndroidWechat, unlockMaterialForDownload } from "@/lib/download-file";
import type { Material } from "@/lib/types";
import MaterialPurchasePreview from "@/components/MaterialPurchasePreview";

type Access = { allowed: boolean; remaining: number; status: string | null; jsapi: boolean; pendingOrder: string | null; codeUrl: string | null; resume: Record<string, string> | null };
type Plan = "single" | "pair";
const qrUrl = (codeUrl: string) => "/api/payments/wechat/qrcode?url=" + encodeURIComponent(codeUrl);

async function invokeWechat(params: Record<string, string>) {
  const bridge = (window as Window & { WeixinJSBridge?: { invoke: (name: string, params: unknown, cb: (result: { err_msg?: string }) => void) => void } }).WeixinJSBridge;
  if (!bridge) throw Error("微信收银台暂不可用，请在微信内重新打开。");
  const result = await new Promise<{ err_msg?: string }>((resolve) => bridge.invoke("getBrandWCPayRequest", params, resolve));
  if (result.err_msg !== "get_brand_wcpay_request:ok") throw Error("未完成支付，可继续支付或取消订单。");
}

export default function MaterialPurchaseCheckout({ material, hasPreview = false }: { material: Material; hasPreview?: boolean }) {
  const slug = material.slug || material.id;
  const page = "/membership/materials?slug=" + encodeURIComponent(slug);
  const endpoint = "/api/payments/materials?slug=" + encodeURIComponent(slug);
  const login = "/login?redirect=" + encodeURIComponent(page);
  const [plan, setPlan] = useState<Plan>("pair");
  const [access, setAccess] = useState<Access | null>(null);
  const [guest, setGuest] = useState(false);
  const [message, setMessage] = useState("");
  const [androidWechat, setAndroidWechat] = useState(false);
  const [inWechat, setInWechat] = useState(false);
  const [browserLink, setBrowserLink] = useState("");
  const [showCopyField, setShowCopyField] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState("");
  const [qr, setQr] = useState("");
  const [pollNonce, setPollNonce] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const wechat = /MicroMessenger/i.test(navigator.userAgent);
    setInWechat(wechat);
    setAndroidWechat(isAndroidWechat());
    setBrowserLink("");
    setShowCopyField(false);
    const params = new URLSearchParams(location.search);
    if (params.get("plan") === "single") setPlan("single");
    if (params.get("jsapi") === "error") setMessage("微信授权未完成，请重试。");
    fetch(endpoint, { signal: ctrl.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return setGuest(true);
        if (!response.ok) throw Error("资料购买状态暂时无法读取，请刷新重试。");
        const data: Access = await response.json();
        if (ctrl.signal.aborted) return;
        setAccess(data);
        if (data.pendingOrder && !data.allowed) {
          setOrder(data.pendingOrder);
          if (data.codeUrl) setQr(qrUrl(data.codeUrl));
        } else if (!data.allowed && data.remaining > 0 && !dialog.current?.open) dialog.current?.showModal();
      })
      .catch((error) => { if (!ctrl.signal.aborted) setMessage(error.message || "暂时无法读取购买状态。"); });
    return () => ctrl.abort();
  }, [endpoint]);

  useEffect(() => {
    if (!order || access?.allowed) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function poll() {
      try {
        const r = await fetch(endpoint + "&order=" + encodeURIComponent(order), { signal: ctrl.signal, cache: "no-store" });
        if (ctrl.signal.aborted) return;
        if (r.status === 404 || r.status === 401) {
          setOrder(""); setQr("");
          if (r.status === 401) setGuest(true);
          return;
        }
        if (r.ok) {
          const next: Access = await r.json();
          if (ctrl.signal.aborted) return;
          setAccess(next);
          if (next.allowed || ["failed","refunded","closed"].includes(next.status || "")) {
            setOrder(""); setQr("");
            setMessage(next.allowed ? "支付成功，可以下载文件了。" : "订单未完成，可重新购买。");
            return;
          }
        }
      } catch {}
      if (!ctrl.signal.aborted && ++attempts < 40) timer = setTimeout(poll, 3000);
      else if (!ctrl.signal.aborted) setMessage("暂未确认付款，可以再次查询订单。");
    }
    void poll();
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [order, endpoint, access?.allowed, pollNonce]);

  async function purchase() {
    if (!access || order || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage("");
    try {
      const jsapi = access.jsapi && /MicroMessenger/i.test(navigator.userAgent);
      const r = await fetch("/api/payments/materials", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, plan, jsapi })
      });
      const data = await r.json();
      if (data.needOAuth) {
        location.href = "/api/payments/wechat/oauth?return=" + encodeURIComponent(page + "&plan=" + plan);
        return;
      }
      if (r.status === 401) { setGuest(true); return; }
      if (!r.ok) throw Error(data.error || "创建订单失败。");
      setOrder(data.outTradeNo);
      if (data.payParams) {
        await invokeWechat(data.payParams);
      } else if (data.codeUrl) {
        setQr(qrUrl(data.codeUrl));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支付暂不可用。");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function manageOrder(cancel: boolean) {
    if (!order || inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      if (cancel) {
        const r = await fetch("/api/payments/materials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) });
        const next = await r.json();
        if (!r.ok) throw Error(next.error || "无法取消订单。");
        setOrder(""); setQr("");
        const check = await fetch(endpoint, { cache: "no-store" });
        if (check.ok) setAccess(await check.json());
      } else if (access?.resume) {
        await invokeWechat(access.resume);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "请稍后重试。");
    } finally { setPollNonce((n) => n + 1); inFlight.current = false; setBusy(false); }
  }

  async function download(redeem = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage("");
    try {
      const url = material.file_url;
      const unlockOnly = redeem && androidWechat && url;
      const result = unlockOnly ? await unlockMaterialForDownload(url) : await downloadMaterialFile(material, redeem);
      setMessage(result.ok ? (unlockOnly ? "已解锁，点击「用浏览器下载」继续。" : "已发起下载，请查看浏览器的下载提示。") : result.error || "下载失败，请重试。");
      if (result.needsLogin) setGuest(true);
      if (redeem) {
        const check = await fetch(endpoint, { cache: "no-store" });
        if (check.ok) setAccess(await check.json());
      }
    } catch { setMessage("网络异常，请稍后重试。"); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function prepareBrowserLink() {
    if (!material.file_url || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setBrowserLink("");
    setShowCopyField(false);
    setMessage("");
    try {
      const response = await fetch(material.file_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ browserLink: true })
      });
      const data = await response.json();
      if (response.status === 401) setGuest(true);
      if (!response.ok) throw Error(data.error || "暂时无法生成下载链接。");
      const url = new URL(material.file_url, location.origin);
      url.searchParams.set("ticket", data.ticket);
      url.searchParams.set("handoff", "1");
      if (androidWechat) {
        location.assign(url.href);
        return;
      }
      setBrowserLink(url.href);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时无法生成下载链接。");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function copyBrowserLink() {
    try {
      await navigator.clipboard.writeText(browserLink);
      setMessage("已复制，请粘贴到手机浏览器打开。");
    } catch {
      setShowCopyField(true);
      setMessage("请长按复制链接，再到手机浏览器打开。");
    }
  }

  const button = "mt-4 min-h-11 w-full rounded-xl bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
  const price = plan === "pair" ? "4.90" : "3.90";
  const purchasing = access && !access.allowed && !access.remaining && !order && !guest;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/library/materials" className="text-sm text-neutral-600">返回资料列表</Link>
      <section className="mt-4 rounded-2xl border border-brand-line bg-white p-5">
        <div className="flex items-start gap-4 sm:gap-6">
          <div aria-hidden="true" className="flex aspect-[3/4] w-24 shrink-0 flex-col justify-between rounded-xl bg-[#f2efe8] p-3 text-[#76624c] sm:w-32 sm:p-4">
            <span className="line-clamp-4 text-xs font-semibold leading-relaxed sm:text-sm">{material.title}</span>
            <span className="border-t border-[#d9d1c6] pt-2 text-xs uppercase">{material.file_type}</span>
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold leading-snug text-brand-ink sm:text-2xl">{material.title}</h1>
            {material.description ? <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-neutral-600">{material.description}</p> : null}
          </div>
        </div>
        {hasPreview ? <MaterialPurchasePreview key={slug} slug={slug} /> : null}
        {purchasing ? <>
          <fieldset className="mt-7 grid gap-3">
            <legend className="mb-3 text-base font-semibold">选择获取方式</legend>
            {([
              ["single", "单份下载", "当前文件", "3.90"],
              ["pair", "双份优惠", "当前文件＋购后任选一份", "4.90"]
            ] as const).map(([key, title, detail, amount]) => (
              <label key={key} className={"flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border px-4 py-4 " + (plan === key ? "border-[#796031] bg-[#fffdf7]" : "border-brand-line")}>
                <input type="radio" name="material-plan" className="h-4 w-4 shrink-0 accent-[#796031]" checked={plan === key} onChange={() => setPlan(key)} disabled={busy} />
                <span className="min-w-0 flex-1"><strong className="block text-sm">{title}</strong><small className="text-neutral-600">{detail}</small></span>
                <strong className="shrink-0">¥{amount}</strong>
              </label>
            ))}
          </fieldset>
          <button type="button" className={button} disabled={busy} onClick={() => void purchase()}>{busy ? "正在发起支付…" : "获取文档 · ¥" + price}</button>
        </> : null}
        {guest ? <Link href={login} className={button + " block text-center"}>登录后继续</Link> : null}
        {!guest && access?.allowed ? <>
          {androidWechat ? (
            <button type="button" className={button} disabled={busy || !material.file_url} onClick={() => void prepareBrowserLink()}>{busy ? "正在准备下载…" : "用浏览器下载"}</button>
          ) : <button type="button" className={button} disabled={busy} onClick={() => void download()}>下载文件</button>}
          {inWechat && !androidWechat && material.file_url ? <div className="mt-2">
            <button type="button" className="min-h-11 w-full rounded-xl border border-brand-line px-4 text-sm font-semibold text-brand-ink disabled:opacity-50" disabled={busy} onClick={() => void prepareBrowserLink()}>
              {browserLink ? "重新生成下载链接" : "用浏览器下载"}
            </button>
            {browserLink ? <>
              <p className="mt-3 text-sm text-neutral-600">链接 5 分钟内有效，请在浏览器打开后下载。</p>
              <div className="flex flex-wrap gap-x-4 text-sm underline">
                <a href={browserLink} rel="noreferrer" className="inline-flex min-h-11 items-center">打开下载链接</a>
                <button type="button" className="min-h-11 underline" onClick={() => void copyBrowserLink()}>复制链接</button>
              </div>
              {showCopyField ? <input type="text" readOnly aria-label="下载链接" value={browserLink} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-lg border border-brand-line p-2 text-sm" /> : null}
            </> : null}
          </div> : null}
          {access.remaining > 0 ? <Link href="/library/materials" className="mt-3 block text-sm text-neutral-600">剩余 {access.remaining} 次免费下载机会 · 去选资料</Link> : null}
        </> : null}
        {!guest && access && !access.allowed && !order && access.remaining > 0 ? (
          <button type="button" className={button} disabled={busy} onClick={() => dialog.current?.showModal()}>使用 1 次免费下载</button>
        ) : null}
        {!guest && order ? <div className="mt-4 text-center">
          {qr ? <>
            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic payment QR code */}
            <img src={qr} width="224" height="224" alt="微信支付二维码" className="mx-auto" />
            <p className="text-sm text-neutral-600">请用微信扫码支付</p>
          </> : null}
          <button type="button" className="mt-2 min-h-11 px-3 text-sm underline" onClick={() => setPollNonce((n) => n + 1)}>查询付款结果</button>
          {access?.resume ? <button type="button" disabled={busy} className="min-h-11 px-3 text-sm underline" onClick={() => void manageOrder(false)}>继续微信支付</button> : null}
          <button type="button" disabled={busy} className="min-h-11 px-3 text-sm underline" onClick={() => void manageOrder(true)}>取消订单</button>
        </div> : null}
        {!guest && !access && !message ? <p className="mt-4 text-sm text-neutral-600">正在核验下载权益…</p> : null}
        {message ? <p className="mt-3 text-sm text-neutral-700" role="status">{message}</p> : null}
        <Link href="/membership/payment" className="mt-6 flex items-center justify-between gap-3 border-t border-brand-line pt-5 text-sm">
          <span><strong className="block">年度会员</strong>有效期内全站资料直接下载</span><strong className="shrink-0">¥99／年</strong>
        </Link>
        <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl p-5 backdrop:bg-black/50" aria-labelledby="material-redeem-title">
          <h2 id="material-redeem-title" className="font-semibold">
            {access && access.remaining > 1
              ? `您还剩 ${access.remaining} 次免费下载机会，是否使用 1 次？`
              : "您仅剩 1 次免费下载机会，是否使用？"}
          </h2>
          <p className="mt-2 break-words text-sm">{material.title}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" autoFocus className="min-h-11 px-3 text-sm" onClick={() => dialog.current?.close()}>取消</button>
            <button type="button" className="min-h-11 rounded-lg bg-brand-ink px-3 text-sm text-white" onClick={() => { dialog.current?.close(); void download(true); }}>确认下载</button>
          </div>
        </dialog>
      </section>
    </main>
  );
}
