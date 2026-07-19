"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { DownloadRecord } from "@/lib/types";
import { listDownloadRecords } from "@/lib/library-store";

export default function DownloadsPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<DownloadRecord[]>([]);

  useEffect(() => {
    async function load() {
      setRecords(await listDownloadRecords(profile?.id));
    }
    load();
  }, [profile?.id]);

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <h1 className="text-3xl font-semibold text-brand-ink">下载记录</h1>
      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-line bg-white shadow-soft">
        {records.map((record) => (
          <div key={record.id} className="grid gap-2 border-b border-brand-line px-5 py-4 text-sm md:grid-cols-[1fr_180px]">
            <Link href={`/materials/${record.material_id}`} className="font-medium text-brand-ink hover:text-brand-sageDark">
              {record.material?.title || record.material_id}
            </Link>
            <span className="text-neutral-500">{new Date(record.created_at).toLocaleString("zh-CN")}</span>
          </div>
        ))}
        {records.length === 0 ? <p className="p-8 text-neutral-500">还没有下载记录。</p> : null}
      </div>
    </section>
  );
}
