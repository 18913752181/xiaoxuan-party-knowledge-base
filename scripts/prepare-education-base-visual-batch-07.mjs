import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "design-assets", "education-bases");
const publicRoot = path.join(root, "public", "images", "education-bases");
const manifestPath = path.join(root, "data", "education-base-visuals-manifest.json");
const sqlPath = path.join(root, "supabase", "027_education_base_visuals_batch_07.sql");
const batchIds = [67, 75, 87, 91, 94];

function sqlText(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const existing = JSON.parse(await readFile(manifestPath, "utf8"));
const batch = [];
for (const id of batchIds) {
  const directory = path.join(sourceRoot, String(id));
  const record = JSON.parse(await readFile(path.join(directory, "source-record.json"), "utf8"));
  if (record.baseId !== id) throw new Error(`基地 ${id} 的 source-record.json ID 不一致。`);
  for (const key of ["identity", "facts", "style", "composition"]) {
    if (record.qa?.[key] !== "pass") throw new Error(`基地 ${id} 的 ${key} 验收未通过。`);
  }
  await mkdir(publicRoot, { recursive: true });
  await copyFile(path.join(directory, record.coverFile), path.join(publicRoot, record.coverFile));
  batch.push({
    id,
    baseName: record.baseName,
    imageUrl: `/images/education-bases/${record.coverFile}`,
    imageAlt: `${record.baseName}主题插画`,
    imageSourceName: record.sourceOrganization || null,
    imageSourceUrl: record.sourceUrl,
    imageRightsStatus: record.rightsStatus || "unknown",
    imageVerifiedAt: record.retrievedAt || null,
    postcardMasterFile: record.postcardMasterFile,
    motifFile: record.motifFile,
    motifCrop: record.motifCrop,
    coverFile: record.coverFile,
  });
}

const byId = new Map(existing.map((record) => [record.id, record]));
for (const record of batch) byId.set(record.id, record);
const manifest = [...byId.values()].sort((a, b) => a.id - b.id);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const values = batch.map((record) => `  (${[
  record.id,
  sqlText(record.imageUrl),
  sqlText(record.imageAlt),
  sqlText(record.imageSourceUrl),
  sqlText(record.imageRightsStatus),
].join(", ")})`).join(",\n");
const sql = `-- education-base-visuals 第 7 批：5 个已通过四项验收的基地插图。\n` +
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
console.log(`Prepared batch: ${batchIds.join(", ")}`);
console.log(`Manifest count: ${manifest.length}`);
