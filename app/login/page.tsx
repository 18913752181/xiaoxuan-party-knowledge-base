"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAuthError } from "@/lib/auth-errors";
import { missingSupabaseEnv, supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [loading, setLoading] = useState<"login" | "logout" | "anonymous" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    async function refreshSession() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      setCurrentUser(data.session?.user.email || (data.session?.user ? "匿名用户" : ""));
    }

    refreshSession();
  }, []);

  function validateConfig() {
    if (missingSupabaseEnv.length > 0 || !supabase) {
      setError(`缺少环境变量：${missingSupabaseEnv.join(", ")}`);
      return false;
    }
    return true;
  }

  function validateForm() {
    if (!email.trim()) {
      setError("邮箱不能为空。");
      return false;
    }
    if (password.length < 6) {
      setError("密码至少 6 位。");
      return false;
    }
    return true;
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!validateConfig() || !validateForm()) return;

    setLoading("login");
    const { data, error: signInError } = await supabase!.auth.signInWithPassword({
      email,
      password
    });
    setLoading("");

    if (signInError) {
      setError(formatAuthError("登录失败", signInError));
      return;
    }

    setCurrentUser(data.user?.email || "匿名用户");
    router.push("/user");
  }

  async function logout() {
    setError("");
    setMessage("");
    if (!validateConfig()) return;

    setLoading("logout");
    const { error: signOutError } = await supabase!.auth.signOut();
    setLoading("");

    if (signOutError) {
      setError(formatAuthError("退出失败", signOutError));
      return;
    }

    setCurrentUser("");
    setMessage("已退出登录。");
  }

  async function devLogin() {
    setError("");
    setMessage("");
    if (!validateConfig()) return;

    setLoading("anonymous");
    const { data, error: signInError } = await supabase!.auth.signInAnonymously();
    setLoading("");

    if (signInError) {
      setError(formatAuthError("开发模式登录失败", signInError));
      return;
    }

    if (!data.session) {
      setError("开发模式登录失败：Supabase 没有返回 session。");
      return;
    }

    setCurrentUser(data.user?.email || "匿名用户");
    router.push("/user");
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-medium text-brand-sageDark">账号登录</p>
          <h1 className="mt-3 text-4xl font-semibold text-brand-ink">邮箱和密码登录</h1>
          <p className="mt-5 text-base leading-8 text-neutral-600">
            使用已注册邮箱和密码登录。忘记密码时，可以通过邮箱重置。
          </p>
          <p className="mt-4 text-sm leading-7 text-neutral-500">
            资料内容仍然读取本地 content 文件夹；这里不接文章数据库、不接支付。
          </p>
        </div>

        <form onSubmit={login} className="rounded-2xl border border-brand-line bg-white p-6 shadow-soft">
          {currentUser ? (
            <div className="mb-5 rounded-xl border border-[#cfe4d5] bg-[#f1f8f3] px-4 py-3 text-sm text-brand-sageDark">
              当前已登录：{currentUser}
            </div>
          ) : null}

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

          <label className="mt-4 block text-sm text-neutral-600">
            密码
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

          {missingSupabaseEnv.length > 0 ? (
            <div className="mt-5 rounded-xl border border-[#ead5d0] bg-[#fff5f2] px-4 py-3 text-sm text-[#9a5245]">
              缺少环境变量：{missingSupabaseEnv.join(", ")}
            </div>
          ) : null}

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
            disabled={Boolean(loading)}
            className="mt-6 h-12 w-full rounded-full bg-brand-sage font-medium text-white transition hover:bg-brand-sageDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "login" ? "正在登录..." : "登录"}
          </button>

          <button
            type="button"
            onClick={logout}
            disabled={Boolean(loading)}
            className="mt-3 h-12 w-full rounded-full border border-brand-line bg-brand-gray font-medium text-neutral-600 transition hover:text-brand-sageDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "logout" ? "正在退出..." : "退出登录"}
          </button>

          {isDevelopment ? (
            <button
              type="button"
              onClick={devLogin}
              disabled={Boolean(loading)}
              className="mt-3 h-12 w-full rounded-full border border-brand-line bg-white font-medium text-neutral-600 transition hover:text-brand-sageDark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === "anonymous" ? "正在登录..." : "开发模式登录"}
            </button>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href="/register" className="text-brand-sageDark hover:underline">
              还没有账号？去注册
            </Link>
            <Link href="/forgot-password" className="text-neutral-500 hover:text-brand-sageDark">
              忘记密码？
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
