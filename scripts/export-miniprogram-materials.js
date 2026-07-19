const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const contentRoot = path.join(projectRoot, "content");
const outputPath = path.join(projectRoot, "miniprogram", "data", "materials.json");
const siteBaseUrl = process.env.SITE_BASE_URL || "https://xiaoxuan-party-knowledge-base.vercel.app";

function readText(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return fallback;
  }
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function fileTypeFromName(fileName) {
  const ext = String(fileName || "").split(".").pop().toLowerCase();
  if (["doc", "docx"].includes(ext)) return "Word";
  if (["xls", "xlsx"].includes(ext)) return "Excel";
  if (ext === "pdf") return "PDF";
  if (["ppt", "pptx"].includes(ext)) return "PPT";
  return "文件";
}

function absoluteUrl(value, slug) {
  if (!value) return `${siteBaseUrl}/api/content-units/${encodeURIComponent(slug)}/download`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function collectUnitDirs() {
  if (!fs.existsSync(contentRoot)) return [];
  const dirs = [];
  for (const category of fs.readdirSync(contentRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryPath = path.join(contentRoot, category.name);
    for (const unit of fs.readdirSync(categoryPath, { withFileTypes: true })) {
      if (unit.isDirectory()) dirs.push(path.join(categoryPath, unit.name));
    }
  }
  return dirs;
}

function exportMaterial(unitDir) {
  const metaPath = path.join(unitDir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;

  const meta = readJson(metaPath, {});
  const slug = meta.slug || path.basename(unitDir);
  const category = meta.category || path.basename(path.dirname(unitDir));
  const files = readJson(path.join(unitDir, "files.json"), []);
  const file = Array.isArray(files) ? files[0] : null;
  const tagsFromFile = readJson(path.join(unitDir, "tags.json"), []);
  const related = readJson(path.join(unitDir, "related.json"), {});
  const summary = meta.summary || readText(path.join(unitDir, "summary.md"));
  const fileType = file?.fileType || meta.fileType || fileTypeFromName(file?.originalName || file?.storedName);

  if (meta.hidden || meta.status === "hidden") return null;

  return {
    id: slug,
    slug,
    title: meta.title || slug,
    description: summary || readText(path.join(unitDir, "introduction.md")).slice(0, 120),
    category,
    topic: meta.topic || category,
    stage: meta.stage || "",
    tags: normalizeList(meta.tags && meta.tags.length ? meta.tags : tagsFromFile),
    fileType,
    fileName: file?.originalName || "",
    fileSize: file?.fileSizeText || "",
    updatedAt: meta.updatedAt || meta.createdAt || "",
    updatedDate: normalizeDate(meta.updatedAt || meta.createdAt),
    downloadUrl: absoluteUrl(file?.downloadPath, slug),
    downloadCount: Number(meta.downloadCount || 0),
    favoriteCount: Number(meta.favoriteCount || 0),
    introduction: readText(path.join(unitDir, "introduction.md")),
    scenarios: readText(path.join(unitDir, "scenarios.md")),
    process: readText(path.join(unitDir, "process.md")),
    policyBasis: readText(path.join(unitDir, "policy.md"), readText(path.join(unitDir, "legal_basis.md"))),
    notices: readText(path.join(unitDir, "notices.md")),
    faq: readText(path.join(unitDir, "faq.md")),
    note: readText(path.join(unitDir, "note.md")),
    related: normalizeList(related.related),
    recommended: normalizeList(related.recommended)
  };
}

const materials = collectUnitDirs()
  .map(exportMaterial)
  .filter(Boolean)
  .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(materials, null, 2)}\n`, "utf8");

console.log(`Exported ${materials.length} materials to ${path.relative(projectRoot, outputPath)}`);
