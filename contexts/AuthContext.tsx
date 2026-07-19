"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Profile } from "@/lib/types";
import { demoAdmin } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

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

const AUTH_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = AUTH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error("账号服务连接超时")), timeoutMs)
    )
  ]);
}

function readDemoProfile() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("xiaoxuan_profile");
  return raw ? (JSON.parse(raw) as Profile) : null;
}

function saveDemoProfile(profile: Profile | null) {
  if (typeof window === "undefined") return;
  if (profile) window.localStorage.setItem("xiaoxuan_profile", JSON.stringify(profile));
  else window.localStorage.removeItem("xiaoxuan_profile");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId?: string | null) {
    if (!isSupabaseConfigured || !supabase) {
      setProfile(readDemoProfile());
      setLoading(false);
      return;
    }

    try {
      const { data: userData } = await withTimeout(supabase.auth.getUser());
      const id = userId ?? userData.user?.id;
      if (!id) {
        setProfile(null);
        return;
      }

      const profileRequest = supabase.from("profiles").select("*").eq("id", id).single();
      const { data, error } = await withTimeout(
        profileRequest as unknown as Promise<{ data: unknown; error: unknown }>
      );
      setProfile(error || !data ? null : (data as Profile));
    } catch {
      // The local site should remain usable when Supabase is offline or unreachable.
      setProfile(readDemoProfile());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    if (!isSupabaseConfigured || !supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      isConfigured: isSupabaseConfigured,
      refreshProfile: async () => loadProfile(),
      signIn: async (email, password) => {
        if (!isSupabaseConfigured || !supabase) {
          const demoProfile = {
            ...demoAdmin,
            email,
            nickname: email.includes("admin") ? "小宣管理员" : "小宣读者",
            is_admin: email.includes("admin")
          };
          saveDemoProfile(demoProfile);
          setProfile(demoProfile);
          return {};
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        await loadProfile();
        return {};
      },
      signUp: async (email, password, nickname, phone) => {
        if (!isSupabaseConfigured || !supabase) {
          const demoProfile: Profile = {
            id: `demo-${Date.now()}`,
            nickname,
            email,
            phone,
            member_status: "free",
            member_expires_at: null,
            is_admin: false
          };
          saveDemoProfile(demoProfile);
          setProfile(demoProfile);
          return {};
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname, phone } }
        });
        if (error) return { error: error.message };
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            nickname,
            email,
            phone,
            member_status: "free",
            member_expires_at: null,
            is_admin: false
          });
        }
        await loadProfile(data.user?.id);
        return {};
      },
      signOut: async () => {
        if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
        saveDemoProfile(null);
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
