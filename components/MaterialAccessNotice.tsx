"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function useMaterialAccess() {
  const [access, setAccess] = useState<{ paid: boolean; used: number; remaining: number } | null>(null);
  const [message, setMessage] = useState("正在核验资料权限…");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/material-access", { cache: "no-store" });
      if (!response.ok) {
        setAccess(null);
        setMessage(response.status === 401 ? "登录后可预览 5 份资料。" : "资料权限暂时无法核验，请稍后重试。");
        return;
      }
      setAccess(await response.json());
      setMessage("");
    } catch { setAccess(null); setMessage("资料权限暂时无法核验，请稍后重试。"); }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("material-access-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("material-access-changed", refresh); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  return { access, message };
}

export function MaterialAccessNotice({ access, message }: ReturnType<typeof useMaterialAccess>) {
  return <div className="my-4 rounded-xl border border-brand-line bg-[#faf9f6] px-4 py-3 text-sm leading-6 text-neutral-600" aria-live="polite">
    <p>{access ? access.paid ? "付费会员：全部资料可预览、下载，支持批量下载。"
      : `普通会员：已预览 ${access.used} / 5 份，还可预览 ${access.remaining} 份新资料。` : message}</p>
    {!access?.paid && <p className="mt-1 text-xs">同一份资料重复预览不扣额度；普通资料可下载，会员专属资料仅付费会员可下载。<Link href="/membership/payment" className="ml-2 text-brand-red underline">开通付费会员</Link></p>}
  </div>;
}
