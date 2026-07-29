import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { defaultWorkLevels, type WorkLevel } from "@/lib/work-panorama";

const dataPath = path.join(process.cwd(), "data", "work-panorama.json");

function normalize(levels: WorkLevel[]) {
  const slugs = new Set<string>();
  return levels
    .map((level) => ({
      ...level,
      slug: String(level.slug || "").trim(),
      name: String(level.name || "").trim(),
      shortDescription: String(level.shortDescription || "").trim(),
      description: String(level.description || "").trim(),
      sections: (level.sections || [])
        .map((section) => ({
          name: String(section.name || "").trim(),
          items: Array.from(new Set((section.items || []).map(String).map((item) => item.trim()).filter(Boolean))),
          keywords: Array.from(new Set((section.keywords || []).map(String).map((item) => item.trim()).filter(Boolean))),
        }))
        .filter((section) => section.name),
    }))
    .filter((level) => {
      if (!level.slug || !level.name || slugs.has(level.slug)) return false;
      slugs.add(level.slug);
      return true;
    });
}

async function writeLevels(levels: WorkLevel[]) {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(normalize(levels), null, 2)}\n`, "utf8");
}

export async function getWorkLevels(): Promise<WorkLevel[]> {
  try {
    return normalize(JSON.parse(await readFile(dataPath, "utf8")) as WorkLevel[]);
  } catch {
    await writeLevels(defaultWorkLevels);
    return defaultWorkLevels;
  }
}

export async function getWorkLevel(slug: string) {
  return (await getWorkLevels()).find((level) => level.slug === slug);
}

export async function addWorkLevel(input: Partial<WorkLevel>) {
  const levels = await getWorkLevels();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("请填写层级名称");
  if (levels.some((level) => level.name === name)) throw new Error("该层级名称已存在");
  const slug = `custom-${Date.now().toString(36)}`;
  levels.push({
    slug,
    name,
    shortDescription: String(input.shortDescription || "").trim(),
    description: String(input.description || "").trim(),
    sections: [],
  });
  await writeLevels(levels);
  return levels;
}

export async function updateWorkLevel(slug: string, input: Partial<WorkLevel>) {
  const levels = await getWorkLevels();
  const index = levels.findIndex((level) => level.slug === slug);
  if (index < 0) throw new Error("未找到该工作层级");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("请填写层级名称");
  if (levels.some((level, position) => position !== index && level.name === name)) throw new Error("该层级名称已存在");
  levels[index] = {
    ...levels[index],
    name,
    shortDescription: String(input.shortDescription ?? levels[index].shortDescription).trim(),
    description: String(input.description ?? levels[index].description).trim(),
  };
  await writeLevels(levels);
  return levels;
}

export async function deleteWorkLevel(slug: string) {
  const levels = await getWorkLevels();
  if (!levels.some((level) => level.slug === slug)) throw new Error("未找到该工作层级");
  const next = levels.filter((level) => level.slug !== slug);
  await writeLevels(next);
  return next;
}

export async function addWorkSection(slug: string, nameValue: string) {
  const levels = await getWorkLevels();
  const level = levels.find((item) => item.slug === slug);
  if (!level) throw new Error("未找到该工作层级");
  const name = nameValue.trim();
  if (!name) throw new Error("请填写分类名称");
  if (level.sections.some((section) => section.name === name)) throw new Error("该分类已存在");
  level.sections.push({ name, items: [], keywords: [] });
  await writeLevels(levels);
  return levels;
}

export async function updateWorkSection(slug: string, oldName: string, input: { name: string; items?: string[]; keywords?: string[] }) {
  const levels = await getWorkLevels();
  const level = levels.find((item) => item.slug === slug);
  const section = level?.sections.find((item) => item.name === oldName);
  if (!level || !section) throw new Error("未找到该工作分类");
  const name = input.name.trim();
  if (!name) throw new Error("请填写分类名称");
  if (level.sections.some((item) => item !== section && item.name === name)) throw new Error("该分类名称已存在");
  section.name = name;
  section.items = input.items || section.items || [];
  section.keywords = input.keywords || section.keywords || [];
  await writeLevels(levels);
  return levels;
}

export async function deleteWorkSection(slug: string, name: string) {
  const levels = await getWorkLevels();
  const level = levels.find((item) => item.slug === slug);
  if (!level) throw new Error("未找到该工作层级");
  level.sections = level.sections.filter((section) => section.name !== name);
  await writeLevels(levels);
  return levels;
}
