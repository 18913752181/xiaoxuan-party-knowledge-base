"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAuthError } from "@/lib/auth-errors";
import { missingSupabaseEnv, supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      if (missingSupabaseEnv.length > 0 || !supabase) {
        setError(`缺少环境变量：${missingSupabaseEnv.join(", ")}`);
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const next = searchParams.get("next") || "/reset-password";
      const code = searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(formatAuthError("读取重置密码链接失败", exchangeError));
          return;
        }
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (sessionError) {
          setError(formatAuthError("建立重置密码会话失败", sessionError));
          return;
        }
      }

      const { data, error: getSessionError } = await supabase.auth.getSession();
      if (getSessionError) {
        setError(formatAuthError("读取重置密码会话失败", getSessionError));
        return;
      }

      if (!data.session) {
        setError("当前链接没有有效的重置密码会话。请重新发送重置密码邮件。");
        return;
      }

      router.replace(next);
    }

    handleCallback();
  }, [router]);

  return (
    <section className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
      <div className="rounded-2xl border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-medium text-brand-sageDark">重置密码</p>
        <h1 className="mt-3 text-3xl font-semibold text-brand-ink">正在打开重置密码页面</h1>
        <p className="mt-4 leading-8 text-neutral-600">正在验证邮箱链接，请稍候。</p>

        {error ? (
          <div className="mt-6 rounded-xl border border-[#ead5d0] bg-[#fff5f2] px-4 py-3 text-sm leading-7 text-[#9a5245]">
            {error}
          </div>
        ) : null}

        {error ? (
          <Link href="/forgot-password" className="mt-5 inline-flex text-sm text-brand-sageDark hover:underline">
            重新发送重置邮件
          </Link>
        ) : null}
      </div>
    </section>
  );
}
