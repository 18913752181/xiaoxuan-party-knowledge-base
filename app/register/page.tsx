"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAuthError } from "@/lib/auth-errors";
import { missingSupabaseEnv, supabase } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!validateConfig() || !validateForm()) return;

    setLoading(true);
    const { data, error: signUpError } = await supabase!.auth.signUp({
      email,
      password
    });
    setLoading(false);

    if (signUpError) {
      setError(formatAuthError("注册失败", signUpError));
      return;
    }

    if (data.session?.user) {
      setMessage("注册成功，正在进入个人页。");
      router.push("/user");
      return;
    }

    setMessage("注册成功，请先前往邮箱确认后再登录。");
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-medium text-brand-sageDark">创建账号</p>
          <h1 className="mt-3 text-4xl font-semibold text-brand-ink">注册小宣同志资料库</h1>
          <p className="mt-5 text-base leading-8 text-neutral-600">
            使用邮箱和密码创建账号。注册后可以登录个人页，收藏常用资料。
          </p>
          <p className="mt-4 text-sm leading-7 text-neutral-500">
            如果 Supabase 开启了邮箱确认，注册成功后需要先完成邮箱验证。
          </p>
        </div>

        <form onSubmit={register} className="rounded-2xl border border-brand-line bg-white p-6 shadow-soft">
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
            disabled={loading}
            className="mt-6 h-12 w-full rounded-full bg-brand-sage font-medium text-white transition hover:bg-brand-sageDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "正在注册..." : "注册"}
          </button>

          <Link href="/login" className="mt-5 inline-flex text-sm text-brand-sageDark hover:underline">
            已有账号？去登录
          </Link>
        </form>
      </div>
    </section>
  );
}
