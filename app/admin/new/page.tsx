"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const statusOptions = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "hidden", label: "已隐藏" }
];

const emptyForm = {
  title: "",
  topic: "",
  stage: "",
  tags: "",
  summary: "",
  status: "published",
  introduction: "",
  policyBasis: "",
  scenarios: "",
  process: "",
  notices: "",
  faq: "",
  downloadNote: "",
  note: "",
  previous: "",
  next: "",
  related: "",
  recommended: ""
};

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
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isVip, setIsVip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

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

  const fileInfo = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name,
      type: fileTypeFromName(file.name),
      size: formatSize(file.size),
      uploadedAt: new Date().toLocaleString()
    };
  }, [file]);

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setForm((current) => ({
      ...current,
      title: nextFile ? nextFile.name.replace(/\.[^.]+$/, "") : ""
    }));
  }

  async function submit() {
    if (!file) return setStatus("请先上传资料文件。");
    if (!form.title.trim()) return setStatus("请填写标题。");
    if (!form.topic.trim()) return setStatus("请选择专题。");

    setLoading(true);
    setStatus("正在保存资料...");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append("category", form.topic);
      body.append("isVip", String(isVip));
      body.append("seoTitle", form.title);
      body.append("seoDescription", form.summary);
      body.append("seoKeywords", form.tags);
      body.append("file", file);
      const response = await fetch("/api/admin/generate", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      const nextTopic = form.topic || topics[0] || "";
      setForm({ ...emptyForm, topic: nextTopic });
      setFile(null);
      setFileInputKey((current) => current + 1);
      setIsVip(false);
      setStatus("保存成功，可继续上传下一份资料。");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
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
          <p className="text-sm text-[#717b75]">支持 Word、Excel、PDF、PPT。文件是主体，知识说明是辅助。</p>
          <input key={fileInputKey} type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,.ppt,.pptx" onChange={(event) => selectFile(event.target.files?.[0] || null)} className="mt-4 block w-full rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm" />
          {fileInfo ? (
            <div className="mt-4 grid gap-3 rounded-xl bg-[#f7f4ed] p-4 text-sm text-[#59635d] sm:grid-cols-2">
              <p>文件名：{fileInfo.name}</p>
              <p>文件类型：{fileInfo.type}</p>
              <p>文件大小：{fileInfo.size}</p>
              <p>选择时间：{fileInfo.uploadedAt}</p>
              <p className="text-[#6f8f7e]">状态：已选择，保存后上传成功</p>
            </div>
          ) : null}
        </Section>

        <Section title="二、资料基本信息">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="标题" value={form.title} onChange={() => {}} readOnly placeholder="选择文件后自动显示文件名" />
            <Select label="所属专题" value={form.topic} options={topics} onChange={(value) => setField("topic", value)} />
            <Input label="所属阶段" value={form.stage} onChange={(value) => setField("stage", value)} />
            <Input label="标签" value={form.tags} onChange={(value) => setField("tags", value)} placeholder="用逗号分隔" />
            <Select label="状态" value={form.status} options={statusOptions.map((item) => item.value)} labels={Object.fromEntries(statusOptions.map((item) => [item.value, item.label]))} onChange={(value) => setField("status", value)} />
          </div>
          <Input label="一句话简介" value={form.summary} onChange={(value) => setField("summary", value)} />
          <label className="mt-4 flex items-center gap-2 text-sm text-[#59635d]">
            <input type="checkbox" checked={isVip} onChange={(event) => setIsVip(event.target.checked)} />
            是否会员资料
          </label>
        </Section>

        <Section title="三、知识说明内容">
          <TextArea label="知识简介" value={form.introduction} onChange={(value) => setField("introduction", value)} />
          <TextArea label="政策依据" value={form.policyBasis} onChange={(value) => setField("policyBasis", value)} />
          <TextArea label="适用场景" value={form.scenarios} onChange={(value) => setField("scenarios", value)} />
          <TextArea label="办理流程" value={form.process} onChange={(value) => setField("process", value)} />
          <TextArea label="注意事项" value={form.notices} onChange={(value) => setField("notices", value)} />
          <TextArea label="常见问题 FAQ" value={form.faq} onChange={(value) => setField("faq", value)} />
          <TextArea label="下载说明" value={form.downloadNote} onChange={(value) => setField("downloadNote", value)} />
          <TextArea label="小宣提醒" value={form.note} onChange={(value) => setField("note", value)} />
        </Section>

        <Section title="四、知识网络">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="前置节点" value={form.previous} onChange={(value) => setField("previous", value)} />
            <Input label="后续节点" value={form.next} onChange={(value) => setField("next", value)} />
            <Input label="关联节点" value={form.related} onChange={(value) => setField("related", value)} />
            <Input label="推荐阅读" value={form.recommended} onChange={(value) => setField("recommended", value)} />
          </div>
        </Section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={submit} disabled={loading} className="rounded-full bg-[#6f8f7e] px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
            {loading ? "正在保存..." : "保存资料"}
          </button>
        </div>
        {status ? <p className="mt-4 text-sm text-[#6d746f]">{status}</p> : null}
      </div>
    </main>
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
