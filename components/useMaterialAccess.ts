"use client";
import { useCallback, useEffect, useState } from "react";

export function useMaterialAccess() {
  const [access, setAccess] = useState<{ paid: boolean; used: number; remaining: number } | null>(null);
  const [message, setMessage] = useState("正在核验资料权限…");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/material-access", { cache: "no-store" });
      if (!response.ok) {
        setAccess(null);
        setMessage(response.status === 401 ? "请先登录。" : "资料权限暂时无法核验，请稍后重试。");
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

