"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Stats = {
  range: { from: string; to: string };
  tiles: {
    downloadsTotal: number;
    downloadsToday: number;
    favoritesTotal: number;
    favoriteUsers: number;
    loginUsers: number;
    activeLoginUsers: number;
    membersActive: number;
    membersTotal: number;
  };
  details: {
    downloads: Array<{ created_at: string; email: string; title: string; article_slug: string }>;
    favorites: Array<{ created_at: string; email: string; title: string; article_slug: string; active: boolean }>;
    logins: Array<{ created_at: string; email: string; member_status: string }>;
    donations: Array<{ created_at: string; email: string; amount_cents: number; source_title: string; status: string }>;
  };
  rankings: {
    downloads: Array<{ title: string; slug: string; count: number }>;
    favorites: Array<{ title: string; slug: string; count: number }>;
    donations: Array<{ title: string; slug: string; amount_cents: number }>;
  };
};

function todayPlus(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function formatYuan(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

const donationStatusText: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  cancelled: "已取消"
};

export default function AdminStatsPage() {
  const [from, setFrom] = useState(todayPlus(-29));
  const [to, setTo] = useState(todayPlus(0));
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/stats?from=${fromDate}&to=${toDate}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "读取统计失败");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取统计失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiles = stats
    ? [
        { label: "累计下载次数", value: stats.tiles.downloadsTotal },
        { label: "今日下载次数", value: stats.tiles.downloadsToday },
        { label: "累计收藏次数", value: stats.tiles.favoritesTotal },
        { label: "当前收藏人数", value: stats.tiles.favoriteUsers },
        { label: "累计登录人数", value: stats.tiles.loginUsers },
        { label: "当前登录人数(24h)", value: stats.tiles.activeLoginUsers },
        { label: "当前会员人数", value: stats.tiles.membersActive },
        { label: "累计会员数", value: stats.tiles.membersTotal }
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-6 py-12 text-[#2f3732]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#6f8f7e]">后台管理</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">数据统计</h1>
          </div>
          <Link href="/admin" className="text-sm text-[#6f8f7e] underline-offset-4 hover:underline">
            返回后台首页
          </Link>
        </div>

        <form
          className="mt-6 flex flex-wrap items-center gap-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            load(from, to);
          }}
        >
          <label className="flex items-center gap-2">
            开始
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[#e4ded2] bg-white px-3 py-1.5" />
          </label>
          <label className="flex items-center gap-2">
            结束
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[#e4ded2] bg-white px-3 py-1.5" />
          </label>
          <button type="submit" className="rounded-lg bg-[#6f8f7e] px-4 py-1.5 text-white transition hover:bg-[#5d7c6c]">
            查询
          </button>
          <span className="text-[#717b75]">默认最近 30 天</span>
        </form>

        {error ? <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {loading ? <p className="mt-10 text-[#717b75]">正在读取统计数据…</p> : null}

        {stats ? (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-2xl border border-[#e4ded2] bg-white p-5 shadow-sm">
                  <p className="text-sm text-[#717b75]">{tile.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{tile.value}</p>
                </div>
              ))}
            </div>

            <h2 className="mt-12 text-xl font-semibold">资料排行 TOP10</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <RankingCard title="下载最多" rows={stats.rankings.downloads.map((r) => ({ name: r.title, value: `${r.count} 次` }))} />
              <RankingCard title="收藏最多" rows={stats.rankings.favorites.map((r) => ({ name: r.title, value: `${r.count} 次` }))} />
              <RankingCard title="赞赏最多" rows={stats.rankings.donations.map((r) => ({ name: r.title, value: formatYuan(r.amount_cents) }))} />
            </div>

            <DetailTable
              title="下载明细"
              head={["时间", "用户", "资料名称"]}
              rows={stats.details.downloads.map((r) => [formatTime(r.created_at), r.email, r.title])}
            />
            <DetailTable
              title="收藏明细"
              head={["时间", "用户", "资料名称", "当前是否收藏"]}
              rows={stats.details.favorites.map((r) => [formatTime(r.created_at), r.email, r.title, r.active ? "是" : "否"])}
            />
            <DetailTable
              title="登录明细"
              head={["时间", "用户", "会员状态"]}
              rows={stats.details.logins.map((r) => [formatTime(r.created_at), r.email, r.member_status === "member" ? "会员" : "免费"])}
            />
            <DetailTable
              title="赞赏明细"
              head={["时间", "用户", "赞赏金额", "来源资料", "支付状态"]}
              rows={stats.details.donations.map((r) => [
                formatTime(r.created_at),
                r.email,
                formatYuan(Number(r.amount_cents || 0)),
                r.source_title || "全站支持",
                donationStatusText[r.status] || r.status
              ])}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

function RankingCard({ title, rows }: { title: string; rows: Array<{ name: string; value: string }> }) {
  return (
    <div className="rounded-2xl border border-[#e4ded2] bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="mt-4 text-sm text-[#717b75]">暂无数据</p> : null}
      <ol className="mt-3 space-y-2 text-sm">
        {rows.map((row, index) => (
          <li key={`${row.name}-${index}`} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              <span className="mr-2 text-[#9aa39e]">{index + 1}.</span>
              {row.name}
            </span>
            <span className="shrink-0 font-medium text-[#6f8f7e]">{row.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DetailTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e4ded2] bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#e4ded2] text-[#717b75]">
              {head.map((col) => (
                <th key={col} className="px-5 py-3 font-medium">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-[#f0ebe1] last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-5 py-3">{cell}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={head.length} className="px-5 py-8 text-center text-[#9aa39e]">
                  该时间段内暂无数据
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
