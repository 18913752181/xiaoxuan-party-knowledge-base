import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import type { WorkLevel } from "@/lib/work-panorama";
import { getWorkLevels } from "@/lib/work-panorama-store";

export type TopicPanoramaPlacement = {
  level: WorkLevel["slug"];
  section: string;
};

export type TopicPanoramaMap = Record<string, TopicPanoramaPlacement[]>;

const dataPath = path.join(process.cwd(), "data", "topic-panorama.json");

const initialMap: TopicPanoramaMap = {
  主题党日: [
    { level: "party-committee", section: "组织建设与干部人才" },
    { level: "general-party-branch", section: "党员教育管理" },
    { level: "general-party-branch", section: "组织生活与主题活动" },
    { level: "party-branch", section: "组织生活" },
    { level: "party-branch", section: "党员队伍" },
  ],
  民主生活会: [
    { level: "party-committee", section: "党的领导与政治建设" },
    { level: "party-committee", section: "全面从严治党" },
  ],
  发展党员: [
    { level: "party-committee", section: "组织建设与干部人才" },
    { level: "party-branch", section: "党员队伍" },
  ],
  换届选举: [
    { level: "party-committee", section: "组织建设与干部人才" },
    { level: "general-party-branch", section: "指导所属党支部建设" },
    { level: "party-branch", section: "支部建设" },
  ],
  三会一课: [
    { level: "general-party-branch", section: "组织生活与主题活动" },
    { level: "party-branch", section: "组织生活" },
  ],
  党员培训: [
    { level: "party-committee", section: "理论学习与思想建设" },
    { level: "general-party-branch", section: "党员教育管理" },
    { level: "party-branch", section: "党员队伍" },
  ],
  第一议题: [
    { level: "party-committee", section: "党的领导与政治建设" },
    { level: "party-committee", section: "理论学习与思想建设" },
  ],
  中心组学习: [{ level: "party-committee", section: "理论学习与思想建设" }],
  组织生活会: [
    { level: "general-party-branch", section: "组织生活与主题活动" },
    { level: "party-branch", section: "组织生活" },
  ],
  支部建设: [
    { level: "general-party-branch", section: "指导所属党支部建设" },
    { level: "party-branch", section: "支部建设" },
  ],
};

function isValidPlacement(value: TopicPanoramaPlacement, levels: WorkLevel[]) {
  const level = levels.find((item) => item.slug === value.level);
  return Boolean(level?.sections.some((section) => section.name === value.section));
}

function normalizePlacements(values: TopicPanoramaPlacement[], levels: WorkLevel[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.level}:${value.section}`;
    if (!isValidPlacement(value, levels) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function writeMap(value: TopicPanoramaMap) {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function getTopicPanoramaMap(): Promise<TopicPanoramaMap> {
  const levels = await getWorkLevels();
  try {
    const parsed = JSON.parse(await readFile(dataPath, "utf8")) as TopicPanoramaMap;
    return Object.fromEntries(
      Object.entries(parsed).map(([topic, placements]) => [topic, normalizePlacements(placements || [], levels)])
    );
  } catch {
    await writeMap(initialMap);
    return initialMap;
  }
}

export async function setTopicPanoramaPlacements(topic: string, placements: TopicPanoramaPlacement[]) {
  const name = topic.trim();
  if (!name) throw new Error("专题名称不能为空");
  const map = await getTopicPanoramaMap();
  map[name] = normalizePlacements(placements, await getWorkLevels());
  await writeMap(map);
  return map;
}

export async function renameTopicPanoramaPlacements(oldName: string, newName: string) {
  const map = await getTopicPanoramaMap();
  if (oldName !== newName && map[oldName]) {
    map[newName] = normalizePlacements([...(map[newName] || []), ...map[oldName]], await getWorkLevels());
    delete map[oldName];
    await writeMap(map);
  }
  return map;
}

export async function renamePanoramaSection(level: string, oldName: string, newName: string) {
  const map = await getTopicPanoramaMap();
  Object.values(map).forEach((placements) => {
    placements.forEach((placement) => {
      if (placement.level === level && placement.section === oldName) placement.section = newName;
    });
  });
  await writeMap(map);
}

export async function removePanoramaSection(level: string, section: string) {
  const map = await getTopicPanoramaMap();
  Object.keys(map).forEach((topic) => {
    map[topic] = map[topic].filter(
      (placement) => !(placement.level === level && placement.section === section)
    );
  });
  await writeMap(map);
}

export async function removePanoramaLevel(level: string) {
  const map = await getTopicPanoramaMap();
  Object.keys(map).forEach((topic) => {
    map[topic] = map[topic].filter((placement) => placement.level !== level);
  });
  await writeMap(map);
}

export async function deleteTopicPanoramaPlacements(topic: string) {
  const map = await getTopicPanoramaMap();
  if (map[topic]) {
    delete map[topic];
    await writeMap(map);
  }
  return map;
}

export function topicsForPlacement(
  map: TopicPanoramaMap,
  level: WorkLevel["slug"],
  section: string
) {
  return Object.entries(map)
    .filter(([, placements]) =>
      placements.some((placement) => placement.level === level && placement.section === section)
    )
    .map(([topic]) => topic);
}
