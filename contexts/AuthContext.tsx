"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type AuthContextValue = {
  profile: Profile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, nickname: string, phone?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const sequence = useRef(0);
  const loadProfile = useCallback(async () => {
    const ticket = ++sequence.current;
    try {
      const response = await fetch("/api/auth/profile", { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401 && ticket === sequence.current) setProfile(null);
        return;
      }
      const data = await response.json();
      if (ticket === sequence.current) setProfile(data.profile || null);
    } catch {
      // Keep the account while a background refresh is temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const refresh = () => { void loadProfile(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener("material-points-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("material-points-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      isConfigured: isSupabaseConfigured,
      refreshProfile: loadProfile,
      signIn: async () => ({ error: "请使用邮箱验证码登录。" }),
      signUp: async () => ({ error: "首次使用邮箱验证码后会自动创建账号。" }),
      signOut: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        sequence.current++;
        setProfile(null);
      }
    }),
    [profile, loading, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
