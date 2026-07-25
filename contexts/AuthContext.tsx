"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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

  async function loadProfile() {
    try {
      const response = await fetch("/api/auth/profile", { cache: "no-store" });
      if (!response.ok) {
        setProfile(null);
        return;
      }
      const data = await response.json();
      setProfile(data.profile || null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

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
        setProfile(null);
      }
    }),
    [profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
