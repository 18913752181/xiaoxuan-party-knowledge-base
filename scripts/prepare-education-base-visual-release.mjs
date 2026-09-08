import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "design-assets", "education-bases");
const publicRoot = path.join(root, "public", "images", "education-bases");
const manifestPath = path.join(root, "data", "education-base-visuals-manifest.json");
const sqlPath = path.join(root, "supabase", "021_education_base_visuals_batch.sql");
const excludedIds = new Set([
  104, // 线上基地记录已删除，不重新创建。
  113  // 已单独上线，保留现有绑定。
]);

function sqlText(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const entries = await readdir(sourceRoot, { withFileTypes: true });
const records = [];

for (const entry of entries) {
  if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
  const id = Number(entry.name);
  if (excludedIds.has(id)) continue;

  const directory = path.join(sourceRoot, entry.name);
  let record;
  try {
    record = JSON.parse(await readFile(path.join(directory, "source-record.json"), "utf8"));
  } catch {
    continue;
  }

  if (record.baseId !== id) throw new Error(`基地 ${id} 的 source-record.json ID 不一致。`);
  const qa = record.qa || {};
  for (const key of ["identity", "facts", "style", "composition"]) {
    if (qa[key] !== "pass") throw new Error(`基地 ${id} 的 ${key} 验收未通过。`);
  }
  if (!record.coverFile || !record.sourceUrl || !record.baseName) {
    throw new Error(`基地 ${id} 缺少封面、来源网址或标准名称。`);
  }

  const sourceFile = path.join(directory, record.coverFile);
  const targetFile = path.join(publicRoot, record.coverFile);
  await mkdir(publicRoot, { recursive: true });
  await copyFile(sourceFile, targetFile);

  records.push({
    id,
    baseName: record.baseName,
    imageUrl: `/images/education-bases/${record.coverFile}`,
    imageAlt: `${record.baseName}主题插画`,
    imageSourceName: record.sourceOrganization || null,
    imageSourceUrl: record.sourceUrl,
    imageRightsStatus: record.rightsStatus || "unknown",
    imageVerifiedAt: record.retrievedAt || null,
    postcardMasterFile: record.postcardMasterFile || null,
    motifFile: record.motifFile || null,
    motifCrop: record.motifCrop || null,
    coverFile: record.coverFile
  });
}

records.sort((a, b) => a.id - b.id);
if (records.length !== 47) throw new Error(`预期发布 47 个现存基地，实际识别 ${records.length} 个。`);

await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");

const values = records.map((record) => `  (${[
  record.id,
  sqlText(record.imageUrl),
  sqlText(record.imageAlt),
  sqlText(record.imageSourceUrl),
  sqlText(record.imageRightsStatus)
].join(", ")})`).join(",\n");

const sql = `-- education-base-visuals 批量发布：仅绑定已通过四项验收的明信片主插图封面。\n` +
`begin;\n\n` +
`update public.education_bases as base\n` +
`set image_url = visual.image_url,\n` +
`    image_storage_path = null,\n` +
`    image_alt = visual.image_alt,\n` +
`    image_source_url = visual.image_source_url,\n` +
`    image_rights_status = visual.image_rights_status\n` +
`from (values\n${values}\n` +
`) as visual(id, image_url, image_alt, image_source_url, image_rights_status)\n` +
`where base.id = visual.id;\n\n` +
`commit;\n`;

await writeFile(sqlPath, sql, "utf8");
console.log(`Prepared ${records.length} education-base visuals.`);
console.log(`Manifest: ${path.relative(root, manifestPath)}`);
console.log(`SQL: ${path.relative(root, sqlPath)}`);
