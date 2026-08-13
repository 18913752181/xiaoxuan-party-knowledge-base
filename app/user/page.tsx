"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMyFavorites, type FavoriteRow } from "@/lib/favorites";
import { maskAccountEmail, WECHAT_EMAIL_SUFFIX } from "@/lib/display";

type PageState = "loading" | "guest" | "ready" | "error";

export default function UserPage() {
  const [state, setState] = useState<PageState>("loading");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [memberStatus, setMemberStatus] = useState("free");
  const [memberExpiresAt, setMemberExpiresAt] = useState<string | null>(null);
  const [wechatBound, setWechatBound] = useState(false);
  const [inWechat, setInWechat] = useState(false);
  const [wechatMessage, setWechatMessage] = useState("");
  const [unbinding, setUnbinding] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const memberActive = memberStatus === "member" && Boolean(memberExpiresAt && memberExpiresAt >= today);
  const isWechatOnlyAccount = email.endsWith(WECHAT_EMAIL_SUFFIX);

  useEffect(() => {
    async function loadSession() {
      setInWechat(/MicroMessenger/i.test(window.navigator.userAgent));

      // 绑定微信回调带回来的结果提示
      const params = new URLSearchParams(window.location.search);
      if (params.get("wxbind") === "ok") {
        setWechatMessage("微信绑定成功，之后可在微信内一键登录本账号。");
      } else if (params.get("wxbind") === "error") {
        setWechatMessage(params.get("reason") || "微信绑定失败，请重试。");
      }

      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) {
        setState("guest");
        return;
      }

      const data = await response.json();
      if (!data.user) {
        setState("guest");
        return;
      }

      setEmail(data.user.email || "匿名用户");
      setUserId(data.user.id);
      setState("ready");

      // 读取会员状态用于展示会员标识（失败不影响页面其他内容）
      fetch("/api/auth/profile", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((profileData) => {
          if (profileData?.profile) {
            setMemberStatus(profileData.profile.member_status || "free");
            setMemberExpiresAt(profileData.profile.member_expires_at || null);
            setWechatBound(Boolean(profileData.profile.wechat_bound));
          }
        })
        .catch(() => undefined);

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
    await fetch("/api/auth/logout", { method: "POST" });
    setEmail("");
    setUserId("");
    setFavorites([]);
    setState("guest");
  }

  async function unbindWechat() {
    setWechatMessage("");
    setUnbinding(true);
    const response = await fetch("/api/auth/wechat/unbind", { method: "POST" });
    setUnbinding(false);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setWechatMessage(data.error || "解绑失败，请稍后重试。");
      return;
    }
    setWechatBound(false);
    setWechatMessage("已解绑微信。");
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
      <div className="rounded-2xl border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-medium tracking-[0.18em] text-[#9a4650]">个人页</p>
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
              className="mt-5 inline-flex rounded-full bg-[#9a4650] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#7d3540]"
            >
              去登录
            </Link>
          </div>
        ) : null}

        {state === "ready" ? (
          <>
            <div className="mt-6 rounded-xl border border-[#cfe4d5] bg-[#f1f8f3] px-5 py-4">
              <p className="text-sm text-neutral-600">当前用户</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xl font-semibold text-brand-ink">{maskAccountEmail(email)}</p>
                {memberActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c79b52]/15 px-3 py-1 text-xs font-semibold text-[#8a6b50] ring-1 ring-[#c79b52]/40">
                    ★ 会员
                    <span className="font-normal">有效期至 {memberExpiresAt}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500 ring-1 ring-neutral-200">
                    免费用户
                    <Link href="/membership/payment" className="font-medium text-[#9a4650] hover:underline">
                      开通会员
                    </Link>
                  </span>
                )}
              </div>
              <p className="mt-2 break-all text-xs text-neutral-500">User ID：{userId}</p>
              <button
                type="button"
                onClick={signOut}
                className="mt-5 rounded-full border border-brand-line bg-white px-5 py-2 text-sm text-neutral-600 transition hover:text-[#8d2f32]"
              >
                退出登录
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-brand-line bg-brand-gray px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-brand-ink">微信登录</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    {isWechatOnlyAccount
                      ? "当前账号由微信一键登录创建，微信即本账号的登录方式。"
                      : wechatBound
                        ? "已绑定微信，可在微信内一键登录本账号。"
                        : "绑定微信后，可在微信内一键登录本账号，会员与收藏保持不变。"}
                  </p>
                </div>
                {isWechatOnlyAccount ? (
                  <span className="inline-flex items-center rounded-full bg-[#07c160]/10 px-3 py-1 text-xs font-medium text-[#0a8a48] ring-1 ring-[#07c160]/30">
                    微信账号
                  </span>
                ) : wechatBound ? (
                  <button
                    type="button"
                    onClick={unbindWechat}
                    disabled={unbinding}
                    className="rounded-full border border-brand-line bg-white px-4 py-2 text-sm text-neutral-600 transition hover:text-[#8d2f32] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {unbinding ? "正在解绑..." : "解绑微信"}
                  </button>
                ) : inWechat ? (
                  <a
                    href="/api/auth/wechat/bind"
                    className="rounded-full bg-[#07c160] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#06a854]"
                  >
                    绑定微信
                  </a>
                ) : (
                  <span className="text-xs leading-6 text-neutral-400">在微信中打开本站可绑定</span>
                )}
              </div>
              {wechatMessage ? (
                <p className="mt-3 rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-neutral-600">
                  {wechatMessage}
                </p>
              ) : null}
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
