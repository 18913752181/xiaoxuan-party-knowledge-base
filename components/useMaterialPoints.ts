"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { MaterialPointState } from "@/lib/material-point-view";

export function useMaterialPoints() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [snapshot, setSnapshot] = useState<{ userId: string; state: MaterialPointState } | null>(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    if (!userId) { setSnapshot(null); setError(""); return; }
    try {
      const response = await fetch("/api/material-points", { cache: "no-store" });
      if (!response.ok) throw new Error("积分信息暂时无法核验，请重试。");
      const state = await response.json() as MaterialPointState;
      if (sequence.current === ticket) { setSnapshot({ userId, state }); setError(""); }
    } catch {
      if (sequence.current === ticket) {
        setSnapshot(null);
        setError("积分信息暂时无法核验，请重试。");
      }
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
    const onRefresh = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") onRefresh(); };
    let midnightTimer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const dayMs = 86400000;
      const untilMidnight = dayMs - ((Date.now() + 8 * 3600000) % dayMs);
      midnightTimer = setTimeout(() => {
        window.dispatchEvent(new Event("material-points-changed"));
        scheduleMidnight();
      }, untilMidnight + 100);
    };
    scheduleMidnight();
    window.addEventListener("material-points-changed", onRefresh);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(midnightTimer);
      window.removeEventListener("material-points-changed", onRefresh);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  return { state: snapshot?.userId === userId ? snapshot?.state ?? null : null, error, refresh };
}
