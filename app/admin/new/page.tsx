"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Material } from "@/lib/types";
import { WorkClassificationFields } from "@/components/WorkClassificationFields";

const statusOptions = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "hidden", label: "已隐藏" }
];

const knowledgeFields = [
  { key: "note", label: "小宣提醒" },
  { key: "policyBasis", label: "制度依据" },
  { key: "notices", label: "填写说明与注意事项" },
  { key: "faq", label: "常见问题" }
];

const networkFields = [
  { key: "previous", label: "上一步工作" },
  { key: "next", label: "下一步工作" }
];

const emptyForm = {
  title: "",
  topic: "",
  stage: "",
  summary: "",
  status: "published",
  policyBasis: "",
  notices: "",
  faq: "",
  note: "",
  previous: "",
  next: "",
  organizationLevels: "",
  workSections: "",
  workItems: ""
};

const splitList = (value = "") => value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);
const titleFromFileName = (fileName = "") => fileName.replace(/\.(docx?|xlsx?|pdf|pptx?)$/i, "").trim();

function fileTypeFromName(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "doc" || ext === "docx") return "Word";
  if (ext === "xls" || ext === "xlsx") return "Excel";
  if (ext === "pdf") return "PDF";
  if (ext === "ppt" || ext === "pptx") return "PPT";
  return "文件";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminNewPage() {
  const [topics, setTopics] = useState<string[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isVip, setIsVip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadTopics() {
      try {
        const response = await fetch("/api/admin/topics", { cache: "no-store" });
        const data = await response.json();
        const rows = Array.isArray(data.topics) ? data.topics : [];
        if (!active) return;
        setTopics(rows);
        setForm((current) => ({
          ...current,
          topic: rows.includes(current.topic) ? current.topic : rows[0] || ""
        }));
      } catch {
        if (active) setStatus("专题读取失败，请先到专题管理检查配置。");
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
  }, []);

  useEffect(() => {
    fetch("/api/admin/materials", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => setAllMaterials(Array.isArray(rows) ? rows : []))
      .catch(() => setAllMaterials([]));
  }, []);

  const fileInfos = useMemo(() => files.map((file) => ({
    name: file.name,
    type: fileTypeFromName(file.name),
    size: formatSize(file.size)
  })), [files]);
  const isBatch = files.length > 1;

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    setUploadProgress([]);
    setForm((current) => ({
      ...current,
      title: nextFiles.length === 1 ? titleFromFileName(nextFiles[0].name) : ""
    }));
  }

  async function submit() {
    if (!files.length) return setStatus("请先上传资料文件。");
    if (!isBatch && !form.title.trim()) return setStatus("请填写标题。");
    if (!form.topic.trim()) return setStatus("请选择专题。");

    setLoading(true);
    setStatus(`正在上传 0/${files.length} 份资料...`);
    const results: string[] = [];
    const failed: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const title = isBatch ? titleFromFileName(file.name) : form.title.trim();
      setStatus(`正在上传 ${index + 1}/${files.length}：${file.name}`);
      try {
        const body = new FormData();
        Object.entries(form).forEach(([key, value]) => body.append(key, value));
        body.set("title", title);
        body.append("category", form.topic);
        body.append("isVip", String(isVip));
        body.append("seoTitle", title);
        body.append("seoDescription", form.summary);
        body.append("seoKeywords", "");
        body.append("file", file);
        const response = await fetch("/api/admin/generate", { method: "POST", body });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "保存失败");
        results.push(`✓ ${file.name}`);
      } catch (error) {
        failed.push(`${file.name}：${error instanceof Error ? error.message : "保存失败"}`);
      }
      setUploadProgress([...results, ...failed.map((item) => `✕ ${item}`)]);
    }

    if (!failed.length) {
      const nextTopic = form.topic || topics[0] || "";
      setForm({ ...emptyForm, topic: nextTopic });
      setFiles([]);
      setFileInputKey((current) => current + 1);
      setIsVip(false);
      setStatus(`已成功上传 ${results.length} 份资料。`);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } else {
      setStatus(`已上传 ${results.length} 份，${failed.length} 份失败；失败项未创建，可修正后重新选择上传。`);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-6 py-10 text-[#2f3732]">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm text-[#6f8f7e]">返回后台</Link>
          <div className="flex gap-4">
            <Link href="/admin/topics" className="text-sm text-[#6f8f7e]">专题管理</Link>
            <Link href="/admin/materials" className="text-sm text-[#6f8f7e]">资料列表</Link>
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-semibold">资料管理中心</h1>
        <p className="mt-3 text-sm leading-7 text-[#6d746f]">上传资料文件，补充知识说明，形成可下载、可检索、可关联的资料节点。</p>

        <Section title="一、上传资料文件">
          <p className="text-sm text-[#717b75]">支持 Word、Excel、PDF、PPT，可一次选择多份。批量上传会使用下方相同的专题、会员权限和知识说明；每份资料标题自动取文件名。</p>
          <input key={fileInputKey} type="file" multiple accept=".doc,.docx,.xls,.xlsx,.pdf,.ppt,.pptx" onChange={(event) => selectFiles(Array.from(event.target.files || []))} className="mt-4 block w-full rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm" />
          {fileInfos.length ? (
            <div className="mt-4 rounded-xl bg-[#f7f4ed] p-4 text-sm text-[#59635d]">
              <div className="flex flex-wrap items-center justify-between gap-2"><p>已选择 {fileInfos.length} 份资料</p><p className="text-[#6f8f7e]">{isBatch ? "批量上传：标题将自动使用文件名" : "保存后上传成功"}</p></div>
              <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                {fileInfos.map((info) => <li key={info.name} className="grid gap-1 rounded-lg bg-white px-3 py-2 sm:grid-cols-[1fr_auto_auto] sm:gap-4"><span className="truncate">{info.name}</span><span>{info.type}</span><span>{info.size}</span></li>)}
              </ul>
            </div>
          ) : null}
        </Section>

        <Section title="二、资料基本信息">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="标题" value={form.title} onChange={(value) => setField("title", value)} placeholder={isBatch ? "批量上传时自动使用每份文件名" : "选择文件后自动显示文件名"} readOnly={isBatch} />
            <Select label="所属专题" value={form.topic} options={topics} onChange={(value) => setField("topic", value)} />
            <Input label="所属阶段" value={form.stage} onChange={(value) => setField("stage", value)} />
            <Select label="状态" value={form.status} options={statusOptions.map((item) => item.value)} labels={Object.fromEntries(statusOptions.map((item) => [item.value, item.label]))} onChange={(value) => setField("status", value)} />
          </div>
          <Input label="一句话简介" value={form.summary} onChange={(value) => setField("summary", value)} />
          <label className="mt-4 flex items-center gap-2 text-sm text-[#59635d]">
            <input type="checkbox" checked={isVip} onChange={(event) => setIsVip(event.target.checked)} />
            是否会员资料
          </label>
        </Section>

        <Section title="三、工作分类关联">
          <WorkClassificationFields
            organizationLevels={form.organizationLevels}
            workSections={form.workSections}
            workItems={form.workItems}
            onChange={setField}
          />
        </Section>

        <Section title="四、知识说明内容">
          {knowledgeFields.map((field) => (
            <div key={field.key}>
              <TextArea label={field.label} value={form[field.key]} onChange={(value) => setField(field.key, value)} />
              {field.key === "policyBasis" ? (
                <p className="mt-2 text-xs leading-5 text-[#8b918d]">
                  每项制度单独一行。常用制度会自动链接；其他制度可填写“制度名称｜官方原文网址”。
                </p>
              ) : null}
            </div>
          ))}
        </Section>

        <Section title="五、知识网络">
          <p className="text-sm leading-6 text-[#6d746f]">按实际工作顺序关联上一步和下一步资料。未填写的关系不会在前台显示。</p>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            {networkFields.map((field) => (
              <RelationPicker
                key={field.key}
                label={field.label}
                value={form[field.key]}
                materials={allMaterials}
                onChange={(value) => setField(field.key, value)}
              />
            ))}
          </div>
        </Section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={submit} disabled={loading} className="rounded-full bg-[#6f8f7e] px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
            {loading ? "正在保存..." : "保存资料"}
          </button>
        </div>
        {status ? <p className="mt-4 text-sm text-[#6d746f]">{status}</p> : null}
        {uploadProgress.length ? <ul className="mt-3 space-y-1 text-sm text-[#6d746f]">{uploadProgress.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      </div>
    </main>
  );
}

function RelationPicker({ label, value, materials, onChange }: {
  label: string;
  value: string;
  materials: Material[];
  onChange: (value: string) => void;
}) {
  const topicOptions = Array.from(new Set(materials.map((item) => item.topic || item.category).filter(Boolean))).sort();
  const [topic, setTopic] = useState("");
  const [article, setArticle] = useState("");
  const selected = splitList(value);
  const articles = topic ? materials.filter((item) => (item.topic || item.category) === topic) : [];
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

function Input({ label, value, onChange, placeholder = "", readOnly = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; readOnly?: boolean }) {
  return <label className="mt-4 block text-sm font-medium text-[#48524c]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} className={`mt-2 w-full rounded-xl border border-[#ddd5c8] px-4 py-3 text-sm outline-none focus:border-[#7f9a8a] ${readOnly ? "bg-[#f2eee7] text-[#59635d]" : "bg-[#fffdf8]"}`} /></label>;
}

function Select({ label, value, options, onChange, labels }: { label: string; value: string; options: string[]; onChange: (value: string) => void; labels?: Record<string, string> }) {
  return <label className="mt-4 block text-sm font-medium text-[#48524c]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#7f9a8a]">{options.map((item) => <option key={item} value={item}>{labels?.[item] || item}</option>)}</select></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mt-4 block text-sm font-medium text-[#48524c]">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm leading-7 outline-none focus:border-[#7f9a8a]" /></label>;
}
