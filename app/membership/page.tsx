"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function MembershipPage() {
  const { profile } = useAuth();
  const isMember = profile?.member_status === "member";

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <div className="rounded-3xl border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-medium text-brand-sageDark">会员中心</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-brand-ink">把常用资料，安静地放在手边。</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-600">
          会员用于支持小宣同志持续整理资料。这里不接入自动支付，先采用人工开通：联系管理员确认后，在后台为账号开通会员并设置到期时间。
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["会员专属资料下载", "收藏与下载记录同步", "后续资料优先更新"].map((item) => (
            <div key={item} className="rounded-2xl bg-brand-gray p-5 text-sm text-brand-ink">
              {item}
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-brand-line bg-[#fbfaf6] p-5">
          <p className="text-sm text-neutral-500">当前账号状态</p>
          <p className="mt-2 text-xl font-semibold text-brand-ink">
            {profile ? (isMember ? "已开通会员" : "普通用户") : "未登录"}
          </p>
          <p className="mt-2 text-sm text-neutral-600">会员到期时间：{profile?.member_expires_at || "未开通"}</p>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          {profile ? (
            <span className="rounded-full bg-brand-sage px-6 py-3 text-sm font-medium text-white">
              请联系管理员人工开通
            </span>
          ) : (
            <Link href="/login" className="rounded-full bg-brand-sage px-6 py-3 text-sm font-medium text-white">
              先登录账号
            </Link>
          )}
          <Link href="/" className="rounded-full border border-brand-line bg-white px-6 py-3 text-sm text-neutral-600">
            继续浏览资料
          </Link>
        </div>
      </div>
    </section>
  );
}
