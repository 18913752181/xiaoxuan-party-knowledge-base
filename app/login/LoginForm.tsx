"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { maskAccountEmail } from "@/lib/display";

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
  const [inWechat, setInWechat] = useState(false);
  const [loading, setLoading] = useState<"send" | "verify" | "logout" | "">("");
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // 微信内展示“微信一键登录”；带回的错误参数直接提示
    setInWechat(/MicroMessenger/i.test(window.navigator.userAgent));
    if (searchParams.get("wxlogin") === "error") {
      setError(searchParams.get("reason") || "微信登录失败，请重试或使用邮箱登录。");
    }

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

  function startWechatLogin() {
    const target = safeRedirectPath(searchParams.get("redirect")) || "/user";
    window.location.href = `/api/auth/wechat?return=${encodeURIComponent(target)}`;
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-medium tracking-[0.18em] text-[#9a4650]">登录 / 注册</p>
          <h1 className="mt-3 text-2xl font-semibold text-brand-ink">登录小宣资料库</h1>
          <p className="mt-5 text-base leading-8 text-neutral-600">
            微信内可直接使用微信一键登录；也可以输入邮箱并验证 6 位验证码登录。
            新用户首次登录会自动创建账号，无需设置和记忆密码；已有邮箱账号的会员权益不受影响。
          </p>
        </div>

        {currentUser ? (
          <section className="rounded-2xl border border-[#cfe4d5] bg-[#f1f8f3] p-6 shadow-soft">
            <p className="text-sm text-brand-sageDark">当前已登录</p>
            <p className="mt-2 break-all text-base font-medium text-neutral-700">{maskAccountEmail(currentUser)}</p>
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
              当前已登录：{maskAccountEmail(currentUser)}
            </div>
          ) : null}

          {inWechat ? (
            <>
              <button
                type="button"
                onClick={startWechatLogin}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-[#07c160] font-medium text-white shadow-[0_8px_20px_rgba(7,193,96,0.28)] transition hover:bg-[#06ad56] active:scale-[0.99]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M9.5 4C5.36 4 2 6.91 2 10.5c0 2.02 1.15 3.83 2.93 5.02l-.73 2.56 2.9-1.52c.42.1.86.17 1.32.2-.12-.45-.19-.92-.19-1.42 0-3.26 3.13-5.9 7-5.9.24 0 .48.01.71.03C15.32 6.42 12.72 4 9.5 4zM7.3 8.35a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7zm4.4 0a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7zM15.5 11c-3.31 0-6 2.24-6 5s2.69 5 6 5c.62 0 1.22-.08 1.78-.23l2.47 1.3-.62-2.18A4.72 4.72 0 0 0 22 16c0-2.76-3.19-5-6.5-5zm-2.2 2.55a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm4.4 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z" />
                  </svg>
                </span>
                微信一键登录
              </button>
              <p className="mt-2.5 text-center text-xs leading-6 text-neutral-400">
                无需输入邮箱，授权后自动登录 / 注册
              </p>
              <div className="my-6 flex items-center gap-4 text-[11px] tracking-[0.2em] text-neutral-300">
                <span className="h-px flex-1 bg-[#eee9e0]" />
                或使用邮箱验证码
                <span className="h-px flex-1 bg-[#eee9e0]" />
              </div>
            </>
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
            className={`mt-6 h-12 w-full rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              inWechat
                ? "border border-[#9a4650]/45 bg-white text-[#9a4650] hover:bg-[#faf5f4]"
                : "bg-[#9a4650] text-white hover:bg-[#7d3540]"
            }`}
          >
            {loading === "verify" ? "正在验证..." : "验证并登录"}
          </button>

          {!inWechat ? (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs leading-6 text-neutral-400">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-[#07c160]/70" aria-hidden="true">
                <path d="M9.5 4C5.36 4 2 6.91 2 10.5c0 2.02 1.15 3.83 2.93 5.02l-.73 2.56 2.9-1.52c.42.1.86.17 1.32.2-.12-.45-.19-.92-.19-1.42 0-3.26 3.13-5.9 7-5.9.24 0 .48.01.71.03C15.32 6.42 12.72 4 9.5 4zM7.3 8.35a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7zm4.4 0a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7zM15.5 11c-3.31 0-6 2.24-6 5s2.69 5 6 5c.62 0 1.22-.08 1.78-.23l2.47 1.3-.62-2.18A4.72 4.72 0 0 0 22 16c0-2.76-3.19-5-6.5-5zm-2.2 2.55a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm4.4 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z" />
              </svg>
              在微信中打开本站，还可以使用微信一键登录。
            </p>
          ) : null}

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
