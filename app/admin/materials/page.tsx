"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDisplayDate } from "@/lib/format-date";
import type { Material } from "@/lib/types";

const statusLabels: Record<string, string> = {
  published: "已发布",
  draft: "草稿",
  hidden: "已隐藏"
};

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [message, setMessage] = useState("正在读取资料...");
  const [deletingSlug, setDeletingSlug] = useState("");
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("全部分类");

  const topics = useMemo(
    () =>
      Array.from(
        new Set(materials.map((item) => item.topic || item.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return materials.filter((item) => {
      const itemTopic = item.topic || item.category || "";
      const searchable = [
        item.title,
        itemTopic,
        item.stage,
        item.file_type,
        ...(item.tags || [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (topic === "全部分类" || itemTopic === topic) && (!query || searchable.includes(query));
    });
  }, [keyword, materials, topic]);

  async function loadMaterials() {
    setMessage("正在读取资料...");
    try {
      const response = await fetch("/api/admin/materials", { cache: "no-store" });
      if (!response.ok) throw new Error("资料读取失败");
      const rows = await response.json();
      setMaterials(Array.isArray(rows) ? rows : []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? `读取失败：${error.message}` : "读取失败");
    }
  }

  useEffect(() => {
    loadMaterials();
  }, []);

  async function deleteMaterial(item: Material) {
    const slug = item.slug || item.id;
    const confirmed = window.confirm(`确定删除「${item.title}」吗？该操作会删除 content 中对应资料文件夹，前台也将不再显示。`);
    if (!confirmed) return;

    setDeletingSlug(slug);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/materials/${encodeURIComponent(slug)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除失败");
      setMaterials((current) => current.filter((row) => (row.slug || row.id) !== slug));
      setMessage(`已删除：${item.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingSlug("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-6 py-10 text-[#2f3732]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-[#6f8f7e]">返回后台</Link>
            <h1 className="mt-4 text-3xl font-semibold">资料列表</h1>
            <p className="mt-3 text-sm text-[#6d746f]">
              {keyword || topic !== "全部分类"
                ? `找到 ${filteredMaterials.length} 份资料，共 ${materials.length} 份`
                : `共有 ${materials.length} 份资料`}
            </p>
          </div>
          <Link href="/admin/new" className="rounded-full bg-[#6f8f7e] px-5 py-2 text-sm text-white">新增资料</Link>
        </div>

        {message ? <p className="mt-6 text-sm text-[#6d746f]">{message}</p> : null}

        <section className="mt-6 rounded-2xl border border-[#e4ded2] bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
            <label>
              <span className="sr-only">搜索资料</span>
              <input
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索标题、阶段、文件类型或标签"
                className="h-11 w-full rounded-xl border border-[#ddd6cc] bg-[#fffdf9] px-4 text-sm outline-none focus:border-[#6f8f7e]"
              />
            </label>
            <label>
              <span className="sr-only">按分类筛选</span>
              <select
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#ddd6cc] bg-[#fffdf9] px-4 text-sm outline-none focus:border-[#6f8f7e]"
              >
                <option>全部分类</option>
                {topics.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            {keyword || topic !== "全部分类" ? (
              <button
                type="button"
                onClick={() => {
                  setKeyword("");
                  setTopic("全部分类");
                }}
                className="h-11 rounded-xl border border-[#ddd6cc] px-4 text-sm text-[#6d746f]"
              >
                清除筛选
              </button>
            ) : null}
          </div>
        </section>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#e4ded2] bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#fbfaf6] text-[#59635d]">
              <tr>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">专题</th>
                <th className="px-4 py-3">阶段</th>
                <th className="px-4 py-3">文件类型</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => {
                const slug = item.slug || item.id;
                return (
                  <tr key={item.id} className="border-t border-[#eee8dc]">
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3">{item.topic || item.category}</td>
                    <td className="px-4 py-3">{item.stage || "-"}</td>
                    <td className="px-4 py-3">{item.file_type}</td>
                    <td className="px-4 py-3">{statusLabels[item.status || "published"] || item.status || "已发布"}</td>
                    <td className="px-4 py-3">{formatDisplayDate(item.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/admin/materials/${slug}/edit`} className="text-[#6f8f7e]">编辑</Link>
                        <Link href={`/materials/${slug}`} className="text-[#6f8f7e]">预览</Link>
                        <button type="button" onClick={() => deleteMaterial(item)} disabled={deletingSlug === slug} className="text-[#a35c4f] disabled:opacity-50">
                          {deletingSlug === slug ? "删除中" : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredMaterials.length && !message ? (
                <tr className="border-t border-[#eee8dc]">
                  <td colSpan={7} className="px-4 py-10 text-center text-[#6d746f]">
                    没有找到符合条件的资料，请更换关键词或分类。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
