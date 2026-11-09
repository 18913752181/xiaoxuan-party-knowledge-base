"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { MaterialEntitlement } from "@/lib/types";

export function useMaterialAccess(enabled = true) {
  const { profile } = useAuth();
  const userId = enabled ? profile?.id : undefined;
  const [result, setResult] = useState<{ userId: string; access: MaterialEntitlement | null; error: string }>();

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/material-access", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("读取失败");
        const access: MaterialEntitlement = await response.json();
        if (!controller.signal.aborted) setResult({ userId, access, error: "" });
      } catch {
        if (!controller.signal.aborted) setResult({ userId, access: null, error: "下载权限暂时无法核验，请刷新后重试。" });
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);

  return result?.userId === userId ? result : undefined;
}
