"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// 仅允许站内相对路径，防止开放重定向到外部站点。
function safeRedirectPath(value: string | null) {
  if (!value) return "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [loading, setLoading] = useState<"send" | "verify" | "logout" | "">("");
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function refreshSession() {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const loggedInEmail = data.user?.email || "";
      setCurrentUser(loggedInEmail);

      // 已登录用户带着 redirect 参数来到登录页（例如从支付页跳转），
      // 直接送回目标页面，避免“支付页提示未登录 → 登录页提示已登录”的死循环。
      const target = safeRedirectPath(searchParams.get("redirect"));
      if (loggedInEmail && target) {
        await refreshProfile();
        router.push(target);
        router.refresh();
      }
    }

    refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在进入登录页时执行一次
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function sendCode() {
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("请输入邮箱地址。");
      return;
    }

    setLoading("send");
    let response: Response;
    try {
      // 25 秒前端兜底超时：任何网络挂起都不能让按钮永远停在“发送中”
      response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
        signal: AbortSignal.timeout(25000)
      });
    } catch {
      setLoading("");
      setError("发送超时，请检查网络后重试。");
      return;
    }
    setLoading("");

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error || "发送验证码失败。");
      return;
    }

    setVerifiedEmail(normalizedEmail);
    setVerificationCode("");
    setCountdown(60);
    setMessage("6 位验证码已发送，请查看邮箱。新邮箱验证后会自动创建账号。");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    const token = verificationCode.trim();

    if (!verifiedEmail) {
      setError("请先发送邮箱验证码。");
      return;
    }
    if (normalizedEmail !== verifiedEmail) {
      setError("邮箱已修改，请重新发送验证码。");
      return;
    }
    if (!/^\d{6}$/.test(token)) {
      setError("请输入邮箱中收到的 6 位验证码。");
      return;
    }

    setLoading("verify");
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: verifiedEmail, token })
    });
    setLoading("");

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "验证码错误或已失效。");
      return;
    }

    setCurrentUser(data.user?.email || verifiedEmail);
    // 登录成功后立即刷新全局登录状态，确保支付页等页面立刻识别已登录。
    await refreshProfile();
    const redirectTo = safeRedirectPath(searchParams.get("redirect")) || "/user";
    router.push(redirectTo);
    router.refresh();
  }

  async function logout() {
    setError("");
    setMessage("");
    setLoading("logout");
    const response = await fetch("/api/auth/logout", { method: "POST" });
    setLoading("");

    if (!response.ok) {
      setError("退出失败，请稍后重试。");
      return;
    }

    setCurrentUser("");
    setMessage("已退出登录。");
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-medium tracking-[0.18em] text-[#9a4650]">邮箱验证码登录</p>
          <h1 className="mt-3 text-2xl font-semibold text-brand-ink">登录宣知网</h1>
          <p className="mt-5 text-base leading-8 text-neutral-600">
            输入邮箱并验证 6 位验证码即可登录。首次使用的新邮箱会自动创建账号，无需设置和记忆密码。
          </p>
        </div>

        {currentUser ? (
          <section className="rounded-2xl border border-[#cfe4d5] bg-[#f1f8f3] p-6 shadow-soft">
            <p className="text-sm text-brand-sageDark">当前已登录</p>
            <p className="mt-2 break-all text-base font-medium text-neutral-700">{currentUser}</p>
            <p className="mt-3 text-sm leading-7 text-neutral-600">登录状态将自动保留，下次进入无需再次验证。</p>
            <button
              type="button"
              onClick={logout}
              disabled={Boolean(loading)}
              className="mt-6 h-12 w-full rounded-full border border-brand-line bg-white font-medium text-neutral-600 transition hover:text-[#8d2f32] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === "logout" ? "正在退出..." : "退出登录"}
            </button>
          </section>
        ) : null}

        <form onSubmit={verifyCode} className={`rounded-2xl border border-brand-line bg-white p-6 shadow-soft ${currentUser ? "hidden" : ""}`}>
          {currentUser ? (
            <div className="mb-5 rounded-xl border border-[#cfe4d5] bg-[#f1f8f3] px-4 py-3 text-sm text-brand-sageDark">
              当前已登录：{currentUser}
            </div>
          ) : null}

          <label className="block text-sm text-neutral-600">
            邮箱
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-xl border border-brand-line bg-white px-4 outline-none transition focus:border-[#b77b80] focus:ring-2 focus:ring-[#b77b80]/20"
                placeholder="name@example.com"
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={Boolean(loading) || countdown > 0}
                className="shrink-0 rounded-xl bg-[#9a4650] px-4 text-sm font-medium text-white transition hover:bg-[#7d3540] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading === "send" ? "发送中..." : countdown > 0 ? `${countdown} 秒` : "发送验证码"}
              </button>
            </div>
          </label>

          <label className="mt-4 block text-sm text-neutral-600">
            邮箱验证码
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 h-12 w-full rounded-xl border border-brand-line bg-white px-4 tracking-normal outline-none transition focus:border-[#b77b80] focus:ring-2 focus:ring-[#b77b80]/20"
              placeholder="请输入6位验证码"
            />
          </label>

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

          <button
            type="submit"
            disabled={Boolean(loading)}
            className="mt-6 h-12 w-full rounded-full bg-[#9a4650] font-medium text-white transition hover:bg-[#7d3540] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "verify" ? "正在验证..." : "验证并登录"}
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={logout}
              disabled={Boolean(loading)}
              className="mt-3 h-12 w-full rounded-full border border-brand-line bg-brand-gray font-medium text-neutral-600 transition hover:text-[#8d2f32] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === "logout" ? "正在退出..." : "退出登录"}
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}
