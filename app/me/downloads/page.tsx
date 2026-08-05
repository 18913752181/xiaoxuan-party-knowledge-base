"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listRecordedDownloads, listServerDownloads, type RecordedDownload } from "@/lib/download-file";

export default function DownloadsPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<RecordedDownload[]>([]);

  useEffect(() => {
    let cancelled = false;
    const local = profile?.id ? listRecordedDownloads(profile.id) : [];
    listServerDownloads().then((server) => {
      if (cancelled) return;
      if (server.length === 0) {
        setRecords(local);
        return;
      }
      // 合并浏览器里遗留的本地记录，去重后按时间倒序。
      const seen = new Set(server.map((item) => item.article_slug));
      const merged = [...server, ...local.filter((item) => !seen.has(item.article_slug))];
      merged.sort((a, b) => b.downloaded_at.localeCompare(a.downloaded_at));
      setRecords(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1.5 rounded-full bg-[#9a4650]" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-brand-ink">下载记录</h1>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-line bg-white shadow-soft">
        {records.map((record) => (
          <div key={record.article_slug} className="grid gap-2 border-b border-brand-line px-5 py-4 text-sm md:grid-cols-[1fr_180px]">
            <Link href={`/materials/${record.article_slug}`} className="font-medium text-brand-ink transition hover:text-[#8d2f32]">
              {record.title}
            </Link>
            <span className="text-neutral-500">{new Date(record.downloaded_at).toLocaleString("zh-CN")}</span>
          </div>
        ))}
        {records.length === 0 ? <p className="p-8 text-neutral-500">还没有下载记录。</p> : null}
      </div>
    </section>
  );
}
