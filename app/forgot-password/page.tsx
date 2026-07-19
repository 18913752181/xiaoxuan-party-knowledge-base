"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAuthError } from "@/lib/auth-errors";
import { missingSupabaseEnv, supabase } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setTimeout(() => {
      setCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  function validateConfig() {
    if (missingSupabaseEnv.length > 0 || !supabase) {
      setError(`缺少环境变量：${missingSupabaseEnv.join(", ")}`);
      return false;
    }
    return true;
  }

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("邮箱不能为空。");
      return;
    }
    if (!validateConfig()) return;

    setSending(true);
    const { error: resetError } = await supabase!.auth.resetPasswordForEmail(trimmedEmail);
    setSending(false);

    if (resetError) {
      setError(formatAuthError("发送验证码失败", resetError));
      return;
    }

    setCodeSent(true);
    setCountdown(RESEND_SECONDS);
    setMessage("验证码已发送，请查看邮箱并在下方输入验证码和新密码。");
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      setError("邮箱不能为空。");
      return;
    }
    if (!trimmedCode) {
      setError("验证码不能为空。");
      return;
    }
    if (password.length < 6) {
      setError("新密码至少 6 位。");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (!validateConfig()) return;

    setResetting(true);
    const { error: verifyError } = await supabase!.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedCode,
      type: "recovery"
    });

    if (verifyError) {
      setResetting(false);
      setError(formatAuthError("验证码校验失败", verifyError));
      return;
    }

    const { error: updateError } = await supabase!.auth.updateUser({ password });
    if (updateError) {
      setResetting(false);
      setError(formatAuthError("重置密码失败", updateError));
      return;
    }

    await supabase!.auth.signOut();
    setResetting(false);
    setMessage("密码已重置，请使用新密码登录。");
    window.setTimeout(() => router.push("/login"), 800);
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
      <div className="rounded-2xl border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-medium text-brand-sageDark">找回密码</p>
        <h1 className="mt-3 text-3xl font-semibold text-brand-ink">邮箱验证码重置密码</h1>
        <p className="mt-4 leading-8 text-neutral-600">
          输入注册邮箱获取验证码，再填写验证码和新密码完成重置。整个过程不需要打开邮件跳转链接。
        </p>

        <form onSubmit={sendCode} className="mt-6">
          <label className="block text-sm text-neutral-600">
            邮箱
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-brand-line bg-white px-4 outline-none focus:border-brand-sage"
              placeholder="name@example.com"
            />
          </label>

          <button
            type="submit"
            disabled={sending || countdown > 0}
            className="mt-5 h-12 w-full rounded-full bg-brand-sage font-medium text-white transition hover:bg-brand-sageDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "正在发送..." : countdown > 0 ? `${countdown} 秒后可重新发送` : codeSent ? "重新发送验证码" : "发送验证码"}
          </button>
        </form>

        {codeSent ? (
          <form onSubmit={resetPassword} className="mt-8 border-t border-brand-line pt-6">
            <label className="block text-sm text-neutral-600">
              邮箱验证码
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-brand-line bg-white px-4 outline-none focus:border-brand-sage"
                placeholder="请输入邮箱中的验证码"
              />
            </label>

            <label className="mt-4 block text-sm text-neutral-600">
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

            <button
              type="submit"
              disabled={resetting}
              className="mt-6 h-12 w-full rounded-full bg-brand-ink font-medium text-white transition hover:bg-[#1f2723] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resetting ? "正在重置..." : "确认重置密码"}
            </button>
          </form>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-[#ead5d0] bg-[#fff5f2] px-4 py-3 text-sm leading-7 text-[#9a5245]">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-5 rounded-xl border border-[#cfe4d5] bg-[#f1f8f3] px-4 py-3 text-sm leading-7 text-brand-sageDark">
            {message}
          </div>
        ) : null}

        <Link href="/login" className="mt-5 inline-flex text-sm text-brand-sageDark hover:underline">
          返回登录
        </Link>
      </div>
    </section>
  );
}
