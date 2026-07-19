"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMyFavorites, type FavoriteRow } from "@/lib/favorites";
import { missingSupabaseEnv, supabase } from "@/lib/supabase/client";

type PageState = "loading" | "guest" | "ready" | "error";

export default function UserPage() {
  const [state, setState] = useState<PageState>("loading");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);

  useEffect(() => {
    async function loadSession() {
      if (missingSupabaseEnv.length > 0 || !supabase) {
        setState("error");
        setMessage(`缺少环境变量：${missingSupabaseEnv.join(", ")}`);
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setState("error");
        setMessage(`读取 session 失败：${error.message}`);
        return;
      }

      if (!data.session?.user) {
        setState("guest");
        return;
      }

      setEmail(data.session.user.email || "匿名用户");
      setUserId(data.session.user.id);
      setState("ready");

      const favoriteResult = await listMyFavorites();
      if (favoriteResult.error && favoriteResult.error !== "登录后可收藏") {
        setMessage(`收藏读取失败：${favoriteResult.error}`);
      } else {
        setFavorites(favoriteResult.rows);
      }
    }

    loadSession();
  }, []);

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setEmail("");
    setUserId("");
    setFavorites([]);
    setState("guest");
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
      <div className="rounded-2xl border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-medium text-brand-sageDark">个人页</p>
        <h1 className="mt-3 text-3xl font-semibold text-brand-ink">当前登录状态</h1>

        {state === "loading" ? (
          <p className="mt-6 text-neutral-600">正在读取当前 session...</p>
        ) : null}

        {state === "guest" ? (
          <div className="mt-6 rounded-xl border border-brand-line bg-brand-gray px-5 py-4">
            <p className="font-medium text-brand-ink">请先登录</p>
            <p className="mt-2 text-sm leading-7 text-neutral-600">
              登录后这里会显示当前 session 和我的收藏列表。
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex rounded-full bg-brand-sage px-5 py-2 text-sm font-medium text-white hover:bg-brand-sageDark"
            >
              去登录
            </Link>
          </div>
        ) : null}

        {state === "ready" ? (
          <>
            <div className="mt-6 rounded-xl border border-[#cfe4d5] bg-[#f1f8f3] px-5 py-4">
              <p className="text-sm text-neutral-600">当前用户</p>
              <p className="mt-2 text-xl font-semibold text-brand-ink">{email}</p>
              <p className="mt-2 break-all text-xs text-neutral-500">User ID：{userId}</p>
              <button
                type="button"
                onClick={signOut}
                className="mt-5 rounded-full border border-brand-line bg-white px-5 py-2 text-sm text-neutral-600 hover:text-brand-sageDark"
              >
                退出登录
              </button>
            </div>

            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-brand-ink">我的收藏</h2>
                <span className="text-sm text-neutral-500">{favorites.length} 篇</span>
              </div>

              {message ? (
                <div className="mb-4 rounded-xl border border-[#ead5d0] bg-[#fff5f2] px-4 py-3 text-sm text-[#9a5245]">
                  {message}
                </div>
              ) : null}

              {favorites.length ? (
                <div className="grid gap-3">
                  {favorites.map((favorite) => (
                    <Link
                      key={favorite.id}
                      href={`/materials/${favorite.article_slug}`}
                      className="rounded-xl border border-brand-line bg-brand-gray px-4 py-3 transition hover:border-[#d8cfc1]"
                    >
                      <span className="block font-medium text-brand-ink">{favorite.title}</span>
                      <span className="mt-1 block text-sm text-neutral-500">
                        {favorite.category} / {new Date(favorite.created_at).toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-brand-line bg-brand-gray px-5 py-6 text-sm text-neutral-600">
                  暂无收藏。可以去资料库收藏常用资料。
                </div>
              )}
            </section>
          </>
        ) : null}

        {state === "error" ? (
          <div className="mt-6 rounded-xl border border-[#ead5d0] bg-[#fff5f2] px-5 py-4 text-sm text-[#9a5245]">
            {message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
