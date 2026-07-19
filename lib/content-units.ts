import path from "path";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import type { Material } from "@/lib/types";

export const knowledgeCategories = ["发展党员", "换届选举", "三会一课", "组织生活会", "第一议题", "中心组学习", "支部建设", "主题党日", "党课课件"];

export const topicOptions = ["发展党员", "民主生活会", "三会一课", "第一议题", "中心组学习", "换届选举", "主题党日", "党课课件"];

export type RelatedMap = {
  previous: string[];
  next: string[];
  related: string[];
  sameTopic: string[];
  recommended: string[];
};

export type NetworkMap = {
  nodeTitle: string;
  topic: string;
  stage: string;
  keywords: string[];
  linkedNodes: Array<{ title: string; relation: string }>;
};

export type MaterialFile = {
  originalName: string;
  storedName: string;
  fileType: string;
  fileSize: number;
  fileSizeText: string;
  downloadPath: string;
  uploadedAt: string;
};

export type GenerateInput = {
  title: string;
  category: string;
  topic?: string;
  stage?: string;
  tags?: string[];
  summary?: string;
  status?: "draft" | "published" | "hidden";
  isVip?: boolean;
  introduction?: string;
  policyBasis?: string;
  scenarios?: string;
  process?: string;
  notices?: string;
  faq?: string;
  downloadNote?: string;
  note?: string;
  previous?: string[];
  next?: string[];
  related?: string[];
  sameTopic?: string[];
  recommended?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  file?: {
    name: string;
    buffer: Buffer;
    fileType: string;
    fileSize: number;
  };
  content?: string;
  author?: string;
  source?: string;
};

export type ContentUnitMeta = {
  title: string;
  slug: string;
  category: string;
  topic: string;
  stage: string;
  status: "draft" | "published" | "hidden";
  author: string;
  source: string;
  isVip: boolean;
  downloadable: boolean;
  relatedArticles: string[];
  updatedAt: string;
  createdAt: string;
  downloadCount: number;
  favoriteCount: number;
  fileType: string;
  tags: string[];
  summary: string;
  recommended?: boolean;
  hidden?: boolean;
};

export type ContentUnit = {
  slug: string;
  dir: string;
  meta: ContentUnitMeta;
  introduction: string;
  article: string;
  summary: string;
  policyBasis: string;
  scenarios: string;
  process: string;
  notices: string;
  faq: string;
  downloadNote: string;
  note: string;
  legalBasis: string;
  knowledgePoints: string;
  relatedMap: RelatedMap;
  network: NetworkMap;
  seo: { seoTitle: string; seoDescription: string; seoKeywords: string[] };
  files: MaterialFile[];
  tags: string[];
  hasTemplate: boolean;
};

type ListOptions = { includeHidden?: boolean };

const contentRoot = path.join(process.cwd(), "content");
const fallback = "待补充";

const emptyRelated = (): RelatedMap => ({ previous: [], next: [], related: [], sameTopic: [], recommended: [] });

const ensureContentRoot = async () => mkdir(contentRoot, { recursive: true });

const safeFileName = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim() || "未分类";

const readText = async (filePath: string, defaultValue = "") => {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return defaultValue;
  }
};

const readJson = async <T>(filePath: string, defaultValue: T) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return defaultValue;
  }
};

const writeJson = async (filePath: string, value: unknown) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const simpleHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash.toString(36);
};

export function createSlug(title: string) {
  const ascii = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `material-${simpleHash(title || Date.now().toString())}`;
}

const createUniqueSlug = async (title: string) => {
  const existing = new Set((await listContentUnits({ includeHidden: true })).map((unit) => unit.slug));
  const date = new Date().toISOString().slice(0, 10);
  const base = `${date}-${createSlug(title)}`;
  let slug = base;
  let counter = 2;
  while (existing.has(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
};

const collectUnitDirs = async () => {
  await ensureContentRoot();
  const dirs: string[] = [];
  const categories = await readdir(contentRoot, { withFileTypes: true });
  for (const categoryEntry of categories) {
    if (!categoryEntry.isDirectory()) continue;
    const categoryPath = path.join(contentRoot, categoryEntry.name);
    const unitEntries = await readdir(categoryPath, { withFileTypes: true });
    for (const unitEntry of unitEntries) if (unitEntry.isDirectory()) dirs.push(path.join(categoryPath, unitEntry.name));
  }
  return dirs;
};

const formatSize = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function fileTypeFromName(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "doc" || ext === "docx") return "Word";
  if (ext === "xls" || ext === "xlsx") return "Excel";
  if (ext === "pdf") return "PDF";
  if (ext === "ppt" || ext === "pptx") return "PPT";
  if (ext === "md" || ext === "markdown") return "Markdown";
  return "文件";
}

const storedFileName = (originalName: string) => {
  const ext = path.extname(originalName) || ".bin";
  return `template${ext.toLowerCase()}`;
};

const normalizeList = (value: unknown) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeMeta = (meta: Partial<ContentUnitMeta>, dir: string): ContentUnitMeta => {
  const slug = meta.slug || path.basename(dir);
  const category = meta.category || path.basename(path.dirname(dir));
  const title = meta.title || slug;
  const now = new Date().toISOString();
  return {
    title,
    slug,
    category,
    topic: meta.topic || category,
    stage: meta.stage || "",
    status: meta.status || (meta.hidden ? "hidden" : "published"),
    author: meta.author || "小宣同志",
    source: meta.source || "本地导入",
    isVip: Boolean(meta.isVip),
    downloadable: Boolean(meta.downloadable),
    relatedArticles: Array.isArray(meta.relatedArticles) ? meta.relatedArticles : [],
    updatedAt: meta.updatedAt || now,
    createdAt: meta.createdAt || meta.updatedAt || now,
    downloadCount: Number(meta.downloadCount || 0),
    favoriteCount: Number(meta.favoriteCount || 0),
    fileType: meta.fileType || "知识单元",
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    summary: meta.summary || "",
    recommended: Boolean(meta.recommended),
    hidden: Boolean(meta.hidden || meta.status === "hidden"),
  };
};

const normalizeRelated = (value: unknown): RelatedMap => {
  const data = value && typeof value === "object" ? (value as Partial<RelatedMap>) : {};
  return {
    previous: normalizeList(data.previous),
    next: normalizeList(data.next),
    related: normalizeList(data.related),
    sameTopic: normalizeList(data.sameTopic),
    recommended: normalizeList(data.recommended),
  };
};

const normalizeNetwork = (value: unknown, meta: ContentUnitMeta, related: RelatedMap): NetworkMap => {
  const data = value && typeof value === "object" ? (value as Partial<NetworkMap>) : {};
  return {
    nodeTitle: data.nodeTitle || meta.title,
    topic: data.topic || meta.topic,
    stage: data.stage || meta.stage,
    keywords: normalizeList(data.keywords).length ? normalizeList(data.keywords) : meta.tags,
    linkedNodes: Array.isArray(data.linkedNodes)
      ? data.linkedNodes
      : [
          ...related.previous.map((title) => ({ title, relation: "前置节点" })),
          ...related.next.map((title) => ({ title, relation: "后续节点" })),
          ...related.related.map((title) => ({ title, relation: "关联节点" })),
        ],
  };
};

const loadUnit = async (dir: string): Promise<ContentUnit | null> => {
  const metaPath = path.join(dir, "meta.json");
  if (!existsSync(metaPath)) return null;
  const meta = normalizeMeta(await readJson<Partial<ContentUnitMeta>>(metaPath, {}), dir);
  const tagsFromFile = await readJson<string[]>(path.join(dir, "tags.json"), []);
  const tags = meta.tags.length ? meta.tags : tagsFromFile;
  const relatedMap = normalizeRelated(await readJson<Partial<RelatedMap>>(path.join(dir, "related.json"), emptyRelated()));
  const network = normalizeNetwork(await readJson<Partial<NetworkMap>>(path.join(dir, "network.json"), {}), meta, relatedMap);
  const files = await readJson<MaterialFile[]>(path.join(dir, "files.json"), []);
  const primaryFile = files[0];
  const introduction = await readText(path.join(dir, "introduction.md"), "");
  const summary = meta.summary || (await readText(path.join(dir, "summary.md"), ""));
  const policyBasis = await readText(path.join(dir, "policy.md"), await readText(path.join(dir, "legal_basis.md"), fallback));
  const article = await readText(path.join(dir, "article.md"), introduction || summary || fallback);

  return {
    slug: meta.slug,
    dir,
    meta: {
      ...meta,
      tags,
      fileType: primaryFile?.fileType || meta.fileType,
      downloadable: Boolean(files.length || meta.downloadable || existsSync(path.join(dir, "template.docx"))),
      summary,
    },
    introduction,
    article,
    summary,
    policyBasis,
    scenarios: await readText(path.join(dir, "scenarios.md"), ""),
    process: await readText(path.join(dir, "process.md"), ""),
    notices: await readText(path.join(dir, "notices.md"), ""),
    faq: await readText(path.join(dir, "faq.md"), ""),
    downloadNote: await readText(path.join(dir, "download_note.md"), ""),
    note: await readText(path.join(dir, "note.md"), ""),
    legalBasis: policyBasis,
    knowledgePoints: await readText(path.join(dir, "knowledge_points.md"), ""),
    relatedMap,
    network,
    seo: await readJson(path.join(dir, "seo.json"), { seoTitle: meta.title, seoDescription: summary, seoKeywords: tags }),
    files,
    tags,
    hasTemplate: Boolean(files.length || existsSync(path.join(dir, "template.docx"))),
  };
};

export async function listContentUnits(options: ListOptions = {}) {
  const dirs = await collectUnitDirs();
  const units = (await Promise.all(dirs.map(loadUnit))).filter(Boolean) as ContentUnit[];
  return units
    .filter((unit) => options.includeHidden || (!unit.meta.hidden && unit.meta.status !== "hidden"))
    .sort((a, b) => new Date(b.meta.updatedAt).getTime() - new Date(a.meta.updatedAt).getTime());
}

export async function getContentUnitBySlug(slug: string, options: ListOptions = {}) {
  const unit = (await listContentUnits({ includeHidden: true })).find((item) => item.slug === slug) ?? null;
  if (!unit || (!options.includeHidden && (unit.meta.hidden || unit.meta.status === "hidden"))) return null;
  return unit;
}

export async function createContentUnit(input: GenerateInput) {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const category = safeFileName(input.category || input.topic || "未分类");
  const topic = input.topic || category;
  const stage = input.stage || "";
  const slug = await createUniqueSlug(title);
  const dir = path.join(contentRoot, category, slug);
  const summary = input.summary || input.content?.trim().slice(0, 160) || "";
  const relatedMap = normalizeRelated(input);
  const tags = input.tags?.length ? input.tags : [topic, stage, title].filter(Boolean);
  const files: MaterialFile[] = [];

  await mkdir(dir, { recursive: true });
  if (input.file) {
    const storedName = storedFileName(input.file.name);
    await writeFile(path.join(dir, storedName), input.file.buffer);
    files.push({
      originalName: input.file.name,
      storedName,
      fileType: input.file.fileType,
      fileSize: input.file.fileSize,
      fileSizeText: formatSize(input.file.fileSize),
      downloadPath: `/api/content-units/${slug}/download`,
      uploadedAt: now,
    });
  }

  const meta: ContentUnitMeta = {
    title,
    slug,
    category,
    topic,
    stage,
    status: input.status || "published",
    author: input.author || "小宣同志",
    source: input.source || "后台录入",
    isVip: Boolean(input.isVip),
    downloadable: Boolean(files.length),
    relatedArticles: [...relatedMap.previous, ...relatedMap.next, ...relatedMap.related],
    updatedAt: now,
    createdAt: now,
    downloadCount: 0,
    favoriteCount: 0,
    fileType: files[0]?.fileType || "文件",
    tags,
    summary,
    hidden: input.status === "hidden",
  };

  const network = normalizeNetwork({}, meta, relatedMap);
  const seo = {
    seoTitle: input.seoTitle || title,
    seoDescription: input.seoDescription || summary,
    seoKeywords: input.seoKeywords?.length ? input.seoKeywords : tags,
  };

  await writeFile(path.join(dir, "introduction.md"), input.introduction || input.content || fallback, "utf8");
  await writeFile(path.join(dir, "article.md"), input.introduction || input.content || fallback, "utf8");
  await writeFile(path.join(dir, "summary.md"), summary || fallback, "utf8");
  await writeFile(path.join(dir, "policy.md"), input.policyBasis || fallback, "utf8");
  await writeFile(path.join(dir, "legal_basis.md"), input.policyBasis || fallback, "utf8");
  await writeFile(path.join(dir, "scenarios.md"), input.scenarios || fallback, "utf8");
  await writeFile(path.join(dir, "process.md"), input.process || fallback, "utf8");
  await writeFile(path.join(dir, "notices.md"), input.notices || fallback, "utf8");
  await writeFile(path.join(dir, "faq.md"), input.faq || fallback, "utf8");
  await writeFile(path.join(dir, "download_note.md"), input.downloadNote || fallback, "utf8");
  await writeFile(path.join(dir, "note.md"), input.note || fallback, "utf8");
  await writeFile(path.join(dir, "knowledge_points.md"), input.introduction || input.content || fallback, "utf8");
  await writeJson(path.join(dir, "related.json"), relatedMap);
  await writeJson(path.join(dir, "network.json"), network);
  await writeJson(path.join(dir, "seo.json"), seo);
  await writeJson(path.join(dir, "files.json"), files);
  await writeJson(path.join(dir, "tags.json"), tags);
  await writeJson(path.join(dir, "meta.json"), meta);
  return { slug, dir, meta };
}

export async function updateContentUnit(slug: string, input: Partial<GenerateInput>) {
  const unit = await getContentUnitBySlug(slug, { includeHidden: true });
  if (!unit) return null;
  const now = new Date().toISOString();
  const files = [...unit.files];

  if (input.file) {
    const storedName = storedFileName(input.file.name);
    await writeFile(path.join(unit.dir, storedName), input.file.buffer);
    files.splice(0, files.length, {
      originalName: input.file.name,
      storedName,
      fileType: input.file.fileType,
      fileSize: input.file.fileSize,
      fileSizeText: formatSize(input.file.fileSize),
      downloadPath: `/api/content-units/${slug}/download`,
      uploadedAt: now,
    });
  }

  const relatedMap = normalizeRelated({
    previous: input.previous ?? unit.relatedMap.previous,
    next: input.next ?? unit.relatedMap.next,
    related: input.related ?? unit.relatedMap.related,
    sameTopic: input.sameTopic ?? unit.relatedMap.sameTopic,
    recommended: input.recommended ?? unit.relatedMap.recommended,
  });
  const tags = input.tags?.length ? input.tags : unit.tags;
  const meta: ContentUnitMeta = {
    ...unit.meta,
    title: input.title || unit.meta.title,
    category: input.category || unit.meta.category,
    topic: input.topic || unit.meta.topic,
    stage: input.stage ?? unit.meta.stage,
    status: input.status || unit.meta.status,
    isVip: typeof input.isVip === "boolean" ? input.isVip : unit.meta.isVip,
    tags,
    summary: input.summary ?? unit.meta.summary,
    downloadable: Boolean(files.length),
    fileType: files[0]?.fileType || unit.meta.fileType,
    relatedArticles: [...relatedMap.previous, ...relatedMap.next, ...relatedMap.related],
    hidden: input.status === "hidden",
    updatedAt: now,
  };
  const network = normalizeNetwork({}, meta, relatedMap);

  await writeFile(path.join(unit.dir, "introduction.md"), input.introduction ?? unit.introduction, "utf8");
  await writeFile(path.join(unit.dir, "article.md"), input.introduction ?? unit.article, "utf8");
  await writeFile(path.join(unit.dir, "summary.md"), input.summary ?? unit.summary, "utf8");
  await writeFile(path.join(unit.dir, "policy.md"), input.policyBasis ?? unit.policyBasis, "utf8");
  await writeFile(path.join(unit.dir, "legal_basis.md"), input.policyBasis ?? unit.legalBasis, "utf8");
  await writeFile(path.join(unit.dir, "scenarios.md"), input.scenarios ?? unit.scenarios, "utf8");
  await writeFile(path.join(unit.dir, "process.md"), input.process ?? unit.process, "utf8");
  await writeFile(path.join(unit.dir, "notices.md"), input.notices ?? unit.notices, "utf8");
  await writeFile(path.join(unit.dir, "faq.md"), input.faq ?? unit.faq, "utf8");
  await writeFile(path.join(unit.dir, "download_note.md"), input.downloadNote ?? unit.downloadNote, "utf8");
  await writeFile(path.join(unit.dir, "note.md"), input.note ?? unit.note, "utf8");
  await writeJson(path.join(unit.dir, "related.json"), relatedMap);
  await writeJson(path.join(unit.dir, "network.json"), network);
  await writeJson(path.join(unit.dir, "seo.json"), {
    seoTitle: input.seoTitle || unit.seo.seoTitle || meta.title,
    seoDescription: input.seoDescription || unit.seo.seoDescription || meta.summary,
    seoKeywords: input.seoKeywords?.length ? input.seoKeywords : unit.seo.seoKeywords || tags,
  });
  await writeJson(path.join(unit.dir, "files.json"), files);
  await writeJson(path.join(unit.dir, "tags.json"), tags);
  await writeJson(path.join(unit.dir, "meta.json"), meta);
  return getContentUnitBySlug(slug, { includeHidden: true });
}

export async function updateContentUnitMeta(slug: string, updates: Partial<ContentUnitMeta>) {
  const unit = await getContentUnitBySlug(slug, { includeHidden: true });
  if (!unit) return null;
  const meta = normalizeMeta({ ...unit.meta, ...updates, updatedAt: new Date().toISOString() }, unit.dir);
  await writeJson(path.join(unit.dir, "meta.json"), meta);
  return { ...unit, meta };
}

export async function deleteContentUnit(slug: string) {
  const unit = await getContentUnitBySlug(slug, { includeHidden: true });
  if (!unit) return false;
  const resolved = path.resolve(unit.dir);
  if (!resolved.startsWith(path.resolve(contentRoot))) throw new Error("Invalid content unit path.");
  await rm(resolved, { recursive: true, force: true });
  return true;
}

export async function getContentUnitDownloadFilePath(slug: string) {
  const unit = await getContentUnitBySlug(slug, { includeHidden: true });
  if (!unit) return null;
  const file = unit.files[0];
  const candidate = file ? path.join(unit.dir, file.storedName) : path.join(unit.dir, "template.docx");
  if (!existsSync(candidate)) return null;
  const fileStat = await stat(candidate);
  return fileStat.isFile() ? { path: candidate, file, title: unit.meta.title } : null;
}

export async function getContentUnitTemplatePath(slug: string) {
  const result = await getContentUnitDownloadFilePath(slug);
  return result?.path ?? null;
}

export async function updateContentUnitCounter(slug: string, type: "download" | "favorite" | "downloadCount" | "favoriteCount", delta = 1) {
  const unit = await getContentUnitBySlug(slug, { includeHidden: true });
  if (!unit) return null;
  const key = type === "download" || type === "downloadCount" ? "downloadCount" : "favoriteCount";
  const nextValue = Math.max(0, Number(unit.meta[key] || 0) + delta);
  const updated = await updateContentUnitMeta(slug, { [key]: nextValue } as Partial<ContentUnitMeta>);
  return updated?.meta ?? null;
}

export function contentUnitToMaterial(unit: ContentUnit): Material {
  const file = unit.files[0];
  return {
    id: unit.slug,
    title: unit.meta.title,
    description: unit.meta.summary || unit.summary || unit.introduction,
    category: unit.meta.category,
    topic: unit.meta.topic,
    stage: unit.meta.stage,
    status: unit.meta.status,
    file_type: file?.fileType || unit.meta.fileType || "知识单元",
    file_size: file?.fileSizeText || "",
    file_name: file?.originalName || "",
    uploaded_at: file?.uploadedAt || unit.meta.createdAt,
    updated_at: unit.meta.updatedAt,
    member_only: unit.meta.isVip,
    isVip: unit.meta.isVip,
    downloadable: unit.meta.downloadable,
    download_count: unit.meta.downloadCount,
    favorite_count: unit.meta.favoriteCount,
    file_url: file?.downloadPath || (unit.hasTemplate ? `/api/content-units/${unit.slug}/download` : ""),
    tags: unit.tags,
    article: unit.article,
    summary: unit.summary,
    introduction: unit.introduction,
    policyBasis: unit.policyBasis,
    scenarios: unit.scenarios,
    process: unit.process,
    notices: unit.notices,
    faq: unit.faq,
    downloadNote: unit.downloadNote,
    note: unit.note,
    legal_basis: unit.legalBasis,
    knowledge_points: unit.knowledgePoints.split(/\r?\n/).map((item) => item.replace(/^[-*]\s*/, "").trim()).filter(Boolean),
    slug: unit.slug,
    source: unit.meta.source,
    author: unit.meta.author,
    relatedArticles: unit.meta.relatedArticles,
    relatedMap: unit.relatedMap,
    network: unit.network,
    seo: unit.seo,
    is_content_unit: true,
  };
}
