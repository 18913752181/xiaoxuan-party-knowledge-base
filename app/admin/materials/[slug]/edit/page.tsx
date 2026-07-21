"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Material } from "@/lib/types";

const statusOptions = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "hidden", label: "已隐藏" }
];

const knowledgeFields = [
  { key: "introduction", label: "知识简介" },
  { key: "policyBasis", label: "政策依据" },
  { key: "scenarios", label: "适用场景" },
  { key: "process", label: "办理流程" },
  { key: "notices", label: "注意事项" },
  { key: "faq", label: "常见问题 FAQ" },
  { key: "downloadNote", label: "下载说明" },
  { key: "note", label: "小宣提醒" }
];

const networkFields = [
  { key: "previous", label: "前置节点" },
  { key: "next", label: "后续节点" },
  { key: "related", label: "关联节点" },
  { key: "recommended", label: "推荐阅读" }
];

const joinList = (items?: string[]) => (items || []).join("、");
const splitList = (value = "") => value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);

export default function AdminMaterialEditPage() {
  const params = useParams<{ slug: string }>();
  const [material, setMaterial] = useState<Material | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [message, setMessage] = useState("正在读取资料...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/materials/${encodeURIComponent(params.slug)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((row: Material | null) => {
        if (!row) {
          setMessage("未找到资料。");
          return;
        }

        setMaterial(row);
        setIsVip(Boolean(row.member_only));
        setForm({
          title: row.title || "",
          topic: row.topic || row.category || "",
          category: row.topic || row.category || "",
          stage: row.stage || "",
          tags: joinList(row.tags),
          summary: row.summary || row.description || "",
          status: row.status || "published",
          introduction: row.introduction || row.article || "",
          policyBasis: row.policyBasis || row.legal_basis || "",
          scenarios: row.scenarios || "",
          process: row.process || "",
          notices: row.notices || "",
          faq: row.faq || "",
          downloadNote: row.downloadNote || "",
          note: row.note || "",
          previous: joinList(row.relatedMap?.previous),
          next: joinList(row.relatedMap?.next),
          related: joinList(row.relatedMap?.related),
          recommended: joinList(row.relatedMap?.recommended)
        });
        setMessage("");
      })
      .catch((error) => setMessage(`读取失败：${error.message}`));
  }, [params.slug]);

  useEffect(() => {
    fetch("/api/admin/materials", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => setAllMaterials(Array.isArray(rows) ? rows : []))
      .catch(() => setAllMaterials([]));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTopics() {
      try {
        const response = await fetch("/api/admin/topics", { cache: "no-store" });
        const data = await response.json();
        const rows = Array.isArray(data.topics) ? data.topics : [];
        if (!active) return;
        setTopics(rows);

        const latestResponse = await fetch(`/api/admin/materials/${encodeURIComponent(params.slug)}`, {
          cache: "no-store"
        });
        const latest: Material | null = latestResponse.ok ? await latestResponse.json() : null;
        if (!active || !latest) return;
        const latestTopic = latest.topic || latest.category || "";
        setForm((current) =>
          current.topic && !rows.includes(current.topic) && rows.includes(latestTopic)
            ? { ...current, topic: latestTopic, category: latestTopic }
            : current
        );
      } catch {
        if (active) setTopics([]);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void loadTopics();
    }

    void loadTopics();
    window.addEventListener("focus", loadTopics);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", loadTopics);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [params.slug]);

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "topic" ? { category: value } : {}) }));
  }

  async function save() {
    setSaving(true);
    setMessage("正在保存...");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append("isVip", String(isVip));
      body.append("seoTitle", form.title || "");
      body.append("seoDescription", form.summary || "");
      body.append("seoKeywords", form.tags || "");
      if (file) body.append("file", file);

      const response = await fetch(`/api/admin/materials/${encodeURIComponent(params.slug)}`, {
        method: "PUT",
        body
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");

      setMaterial(data.material);
      setMessage("保存成功，前台已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!material) {
    return (
      <main className="min-h-screen bg-[#f7f4ed] px-6 py-10 text-[#2f3732]">
        <p>{message}</p>
      </main>
    );
  }

  const topicOptions = topics.length ? topics : [form.topic || material.topic || material.category].filter(Boolean);

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-6 py-10 text-[#2f3732]">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/materials" className="text-sm text-[#6f8f7e]">返回资料列表</Link>
          <Link href="/admin/topics" className="text-sm text-[#6f8f7e]">专题管理</Link>
          <Link href={`/materials/${material.slug || material.id}`} className="text-sm text-[#6f8f7e]">前台预览</Link>
        </div>
        <h1 className="mt-4 text-3xl font-semibold">编辑资料</h1>
        <p className="mt-3 text-sm text-[#6d746f]">修改后保存到本地 content 文件夹，前台立即读取最新内容。</p>

        <Section title="上传文件">
          <div className="rounded-xl bg-[#f7f4ed] p-4 text-sm text-[#59635d]">
            <p>当前文件：{material.file_name || "暂无"}</p>
            <p className="mt-1">文件类型：{material.file_type || "未标注"}　文件大小：{material.file_size || "-"}</p>
          </div>
          <input type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,.ppt,.pptx" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-4 block w-full rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm" />
        </Section>

        <Section title="资料基本信息">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="标题" value={form.title || ""} onChange={(value) => setField("title", value)} />
            <Select label="所属专题" value={form.topic || ""} options={topicOptions} onChange={(value) => setField("topic", value)} />
            <Input label="所属阶段" value={form.stage || ""} onChange={(value) => setField("stage", value)} />
            <Input label="标签" value={form.tags || ""} onChange={(value) => setField("tags", value)} />
            <Select label="状态" value={form.status || "published"} options={statusOptions.map((item) => item.value)} labels={Object.fromEntries(statusOptions.map((item) => [item.value, item.label]))} onChange={(value) => setField("status", value)} />
          </div>
          <Input label="一句话简介" value={form.summary || ""} onChange={(value) => setField("summary", value)} />
          <label className="mt-4 flex items-center gap-2 text-sm text-[#59635d]">
            <input type="checkbox" checked={isVip} onChange={(event) => setIsVip(event.target.checked)} />
            是否会员资料
          </label>
        </Section>

        <Section title="知识说明内容">
          {knowledgeFields.map((field) => (
            <TextArea key={field.key} label={field.label} value={form[field.key] || ""} onChange={(value) => setField(field.key, value)} />
          ))}
        </Section>

        <Section title="知识网络">
          <p className="text-sm leading-6 text-[#6d746f]">先选择专题，再选择需要关联的文章。保存后，前台会显示文章标题并可直接进入对应资料。</p>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            {networkFields.map((field) => (
              <RelationPicker
                key={field.key}
                label={field.label}
                value={form[field.key] || ""}
                materials={allMaterials}
                currentSlug={material.slug || material.id}
                onChange={(value) => setField(field.key, value)}
              />
            ))}
          </div>
        </Section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="rounded-full bg-[#6f8f7e] px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "正在保存..." : "保存修改"}
          </button>
          {message ? <span className="text-sm text-[#6d746f]">{message}</span> : null}
        </div>
      </div>
    </main>
  );
}

function RelationPicker({ label, value, materials, currentSlug, onChange }: {
  label: string;
  value: string;
  materials: Material[];
  currentSlug: string;
  onChange: (value: string) => void;
}) {
  const available = materials.filter((item) => (item.slug || item.id) !== currentSlug);
  const topicOptions = Array.from(new Set(available.map((item) => item.topic || item.category).filter(Boolean))).sort();
  const [topic, setTopic] = useState("");
  const [article, setArticle] = useState("");
  const selected = splitList(value);
  const articles = topic ? available.filter((item) => (item.topic || item.category) === topic) : [];
  const titleFor = (reference: string) => materials.find((item) => item.slug === reference || item.id === reference)?.title || reference;

  function addArticle() {
    if (!article || selected.includes(article)) return;
    onChange([...selected, article].join("、"));
    setArticle("");
  }

  function removeArticle(reference: string) {
    onChange(selected.filter((item) => item !== reference).join("、"));
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#e4ded2] bg-[#fffdf8] p-4">
      <h3 className="text-sm font-semibold text-[#48524c]">{label}</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select value={topic} onChange={(event) => { setTopic(event.target.value); setArticle(""); }} className="w-full rounded-xl border border-[#ddd5c8] bg-white px-3 py-3 text-sm outline-none focus:border-[#7f9a8a]">
          <option value="">选择专题</option>
          {topicOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={article} onChange={(event) => setArticle(event.target.value)} disabled={!topic} className="w-full rounded-xl border border-[#ddd5c8] bg-white px-3 py-3 text-sm outline-none disabled:text-[#a9aaa7]">
          <option value="">选择文章</option>
          {articles.map((item) => <option key={item.slug || item.id} value={item.slug || item.id}>{item.title}</option>)}
        </select>
      </div>
      <button type="button" onClick={addArticle} disabled={!article} className="mt-3 rounded-full bg-[#6f8f7e] px-4 py-2 text-xs font-medium text-white disabled:opacity-40">添加关联</button>
      {selected.length ? <ul className="mt-3 grid gap-2">
        {selected.map((reference) => <li key={reference} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[#59635d]"><span>{titleFor(reference)}</span><button type="button" onClick={() => removeArticle(reference)} className="shrink-0 text-[#a6404d]">移除</button></li>)}
      </ul> : <p className="mt-3 text-xs text-[#969b97]">暂未关联文章</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-6 rounded-2xl border border-[#e4ded2] bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-semibold">{title}</h2>{children}</section>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mt-4 block text-sm font-medium text-[#48524c]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#7f9a8a]" /></label>;
}

function Select({ label, value, options, onChange, labels }: { label: string; value: string; options: string[]; onChange: (value: string) => void; labels?: Record<string, string> }) {
  return <label className="mt-4 block text-sm font-medium text-[#48524c]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#7f9a8a]">{options.map((item) => <option key={item} value={item}>{labels?.[item] || item}</option>)}</select></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mt-4 block text-sm font-medium text-[#48524c]">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm leading-7 outline-none focus:border-[#7f9a8a]" /></label>;
}
