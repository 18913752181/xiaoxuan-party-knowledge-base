"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { formatAuthError } from "@/lib/auth-errors";
import { missingSupabaseEnv, supabase } from "@/lib/supabase/client";

const cleanResetUrl = () => {
  window.history.replaceState(null, "", "/reset-password");
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSession() {
      if (missingSupabaseEnv.length > 0 || !supabase) {
        setError(`缺少环境变量：${missingSupabaseEnv.join(", ")}`);
        setChecking(false);
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const urlError = searchParams.get("error_description") || hashParams.get("error_description");
      const tokenHash = searchParams.get("token_hash");
      const type = (searchParams.get("type") || "recovery") as EmailOtpType;
      const code = searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (urlError) {
        setError(`重设密码链接无效：${decodeURIComponent(urlError)}`);
        setChecking(false);
        return;
      }

      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type
        });
        if (verifyError) {
          setError(formatAuthError("验证重设密码链接失败", verifyError));
          setChecking(false);
          return;
        }
        cleanResetUrl();
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(formatAuthError("读取重设密码链接失败", exchangeError));
          setChecking(false);
          return;
        }
        cleanResetUrl();
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (sessionError) {
          setError(formatAuthError("建立重设密码会话失败", sessionError));
          setChecking(false);
          return;
        }
        cleanResetUrl();
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(formatAuthError("读取重设密码会话失败", sessionError));
        setChecking(false);
        return;
      }

      setHasSession(Boolean(data.session));
      setChecking(false);
    }

    loadSession();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("新密码至少 6 位。");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (!supabase) {
      setError("Supabase 未配置。");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(formatAuthError("重设密码失败", updateError));
      return;
    }

    setMessage("密码已重设，请使用新密码登录。");
    await supabase.auth.signOut();
    window.setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
      <div className="rounded-2xl border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-medium text-brand-sageDark">重设密码</p>
        <h1 className="mt-3 text-3xl font-semibold text-brand-ink">设置新密码</h1>
        <p className="mt-4 leading-8 text-neutral-600">
          请从邮箱中的重设密码链接打开本页，然后设置一个新密码。
        </p>

        {checking ? (
          <div className="mt-6 rounded-xl border border-brand-line bg-brand-gray px-4 py-3 text-sm text-neutral-600">
            正在验证重设密码链接...
          </div>
        ) : null}

        {!checking && !hasSession ? (
          <div className="mt-6 rounded-xl border border-[#ead5d0] bg-[#fff5f2] px-4 py-3 text-sm leading-7 text-[#9a5245]">
            当前没有有效的重设密码会话。请回到忘记密码页面重新发送邮件，并从最新邮件链接打开本页。
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-6">
          <label className="block text-sm text-neutral-600">
            新密码
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-brand-line bg-white px-4 outline-none focus:border-brand-sage"
              placeholder="至少 6 位"
            />
          </label>

          <label className="mt-4 block text-sm text-neutral-600">
            确认新密码
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-brand-line bg-white px-4 outline-none focus:border-brand-sage"
              placeholder="再次输入新密码"
            />
          </label>

          {error ? (
            <div className="mt-5 rounded-xl border border-[#ead5d0] bg-[#fff5f2] px-4 py-3 text-sm leading-7 text-[#9a5245]">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-5 rounded-xl border border-[#cfe4d5] bg-[#f1f8f3] px-4 py-3 text-sm text-brand-sageDark">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || checking || !hasSession}
            className="mt-6 h-12 w-full rounded-full bg-brand-sage font-medium text-white transition hover:bg-brand-sageDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "正在重设..." : "重设密码"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link href="/forgot-password" className="text-brand-sageDark hover:underline">
            重新发送邮件
          </Link>
          <Link href="/login" className="text-neutral-500 hover:text-brand-sageDark">
            返回登录
          </Link>
        </div>
      </div>
    </section>
  );
}
