"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function MePage() {
  const { profile, loading } = useAuth();

  if (loading) return <section className="mx-auto max-w-5xl px-5 py-12 text-neutral-600">正在读取账号信息...</section>;

  if (!profile) {
    return (
      <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <Link href="/login" className="block rounded-[2rem] border border-[#ebe5dc] bg-white p-8 shadow-sm transition hover:border-[#cddbd3] hover:bg-[#fbfaf6]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#edf3ef] text-2xl text-[#6f8b7b]">宣</div>
            <div>
              <h1 className="text-2xl font-semibold text-brand-ink">点我登录</h1>
              <p className="mt-2 text-sm text-neutral-500">登录后查看下载和收藏的文档。</p>
            </div>
          </div>
        </Link>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#ebe5dc] bg-white shadow-sm">
          <MenuItem href="/login" title="下载的文档" desc="登录后查看下载过的资料" />
          <MenuItem href="/login" title="收藏的文档" desc="登录后查看收藏的资料" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
      <div className="rounded-[2rem] border border-[#ebe5dc] bg-white p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#edf3ef] text-2xl font-semibold text-[#6f8b7b]">宣</div>
          <div>
            <h1 className="text-2xl font-semibold text-brand-ink">{profile.nickname || "小宣用户"}</h1>
            <p className="mt-2 text-sm text-neutral-500">{profile.email || "已登录"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#ebe5dc] bg-white shadow-sm">
        <MenuItem href="/me/downloads" title="下载的文档" desc="查看下载过的模板和资料" />
        <MenuItem href="/me/favorites" title="收藏的文档" desc="查看收藏的常用资料" />
        <MenuItem href="/library" title="最近浏览" desc="继续查找资料和工作流程" />
        <MenuItem href="/user" title="账号设置" desc="查看登录邮箱和账号状态" />
        {profile.is_admin ? <MenuItem href="/admin" title="管理后台" desc="录入和编辑资料" /> : null}
      </div>
    </section>
  );
}

function MenuItem({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center justify-between border-b border-[#f0ebe4] px-6 py-5 last:border-b-0 hover:bg-[#fbfaf6]">
      <span>
        <span className="block text-base font-semibold text-brand-ink">{title}</span>
        <span className="mt-1 block text-sm text-neutral-500">{desc}</span>
      </span>
      <span className="text-xl text-neutral-400">›</span>
    </Link>
  );
}
