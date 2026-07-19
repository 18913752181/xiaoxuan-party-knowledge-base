import path from "path";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { existsSync, type Dirent } from "fs";

export const defaultTopics = ["发展党员", "换届选举", "三会一课", "主题党日", "民主生活会", "第一议题", "中心组学习", "组织生活会", "支部建设"];

const dataDir = path.join(process.cwd(), "data");
const topicsPath = path.join(dataDir, "topics.json");
const contentRoot = path.join(process.cwd(), "content");

function uniqueTopics(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function topicsFromContent() {
  if (!existsSync(contentRoot)) return [];
  const topics: string[] = [];
  let categoryEntries: Dirent[] = [];

  try {
    categoryEntries = await readdir(contentRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const categoryEntry of categoryEntries) {
    if (!categoryEntry.isDirectory()) continue;
    const categoryPath = path.join(contentRoot, categoryEntry.name);
    topics.push(categoryEntry.name);

    let unitEntries: Dirent[] = [];
    try {
      unitEntries = await readdir(categoryPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const unitEntry of unitEntries) {
      if (!unitEntry.isDirectory()) continue;
      const metaPath = path.join(categoryPath, unitEntry.name, "meta.json");
      const meta = await readJson<{ topic?: string }>(metaPath, {});
      if (meta.topic) topics.push(meta.topic);
    }
  }

  return topics;
}

export async function listTopics() {
  const configured = uniqueTopics(await readJson<string[]>(topicsPath, []));
  if (configured.length) return configured;

  const topics = uniqueTopics([...(await topicsFromContent()), ...defaultTopics]);
  await writeJson(topicsPath, topics);
  return topics;
}

export async function addTopic(name: string) {
  const topicName = name.trim();
  if (!topicName) throw new Error("专题名称不能为空");
  const topics = uniqueTopics([...(await listTopics()), topicName]);
  await writeJson(topicsPath, topics);
  return topics;
}

export async function renameTopic(oldName: string, newName: string) {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to) throw new Error("专题名称不能为空");
  if (from === to) return { topics: await listTopics(), updatedMaterials: 0 };

  const topics = uniqueTopics((await listTopics()).map((item) => (item === from ? to : item)));
  await writeJson(topicsPath, topics);

  let updatedMaterials = 0;
  if (!existsSync(contentRoot)) return { topics, updatedMaterials };

  let categoryEntries: Dirent[] = [];
  try {
    categoryEntries = await readdir(contentRoot, { withFileTypes: true });
  } catch {
    return { topics, updatedMaterials };
  }

  for (const categoryEntry of categoryEntries) {
    if (!categoryEntry.isDirectory()) continue;
    const categoryPath = path.join(contentRoot, categoryEntry.name);
    let unitEntries: Dirent[] = [];
    try {
      unitEntries = await readdir(categoryPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const unitEntry of unitEntries) {
      if (!unitEntry.isDirectory()) continue;
      const metaPath = path.join(categoryPath, unitEntry.name, "meta.json");
      const meta = await readJson<Record<string, unknown>>(metaPath, {});
      if (!Object.keys(meta).length) continue;
      if (meta.topic === from || (!meta.topic && meta.category === from)) {
        meta.topic = to;
        if (meta.category === from) meta.category = to;
        meta.updatedAt = new Date().toISOString();
        await writeJson(metaPath, meta);
        updatedMaterials += 1;
      }
    }
  }

  return { topics, updatedMaterials };
}

