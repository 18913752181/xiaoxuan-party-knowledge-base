import { NextResponse } from "next/server";
import { contentUnitToMaterial, listContentUnits } from "@/lib/content-units";
import { addTopic, deleteTopic, listTopics, renameTopic } from "@/lib/topics";
import {
  deleteTopicPanoramaPlacements,
  getTopicPanoramaMap,
  renameTopicPanoramaPlacements,
  setTopicPanoramaPlacements,
  type TopicPanoramaPlacement,
} from "@/lib/topic-panorama";
import { getWorkLevels } from "@/lib/work-panorama-store";

async function topicPayload() {
  const topics = await listTopics();
  const units = await listContentUnits({ includeHidden: true });
  const topicCounts = Object.fromEntries(topics.map((topic) => [topic, 0])) as Record<string, number>;

  units.map(contentUnitToMaterial).forEach((material) => {
    const topic = material.topic || material.category || "";
    if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });

  return {
    topics: [...topics].sort(
      (a, b) => (topicCounts[b] || 0) - (topicCounts[a] || 0) || a.localeCompare(b, "zh-CN")
    ),
    topicCounts,
    topicPlacements: await getTopicPanoramaMap(),
    workLevels: await getWorkLevels(),
  };
}

export async function GET() {
  try {
    return NextResponse.json(await topicPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取专题失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await addTopic(String(body.name || ""));
    return NextResponse.json(await topicPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "新增专题失败" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const result = await renameTopic(String(body.oldName || ""), String(body.newName || ""));
    await renameTopicPanoramaPlacements(String(body.oldName || "").trim(), String(body.newName || "").trim());
    return NextResponse.json({ ...result, ...(await topicPayload()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "修改专题失败" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    await setTopicPanoramaPlacements(
      String(body.name || ""),
      Array.isArray(body.placements) ? (body.placements as TopicPanoramaPlacement[]) : []
    );
    return NextResponse.json(await topicPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存专题关联失败" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const units = await listContentUnits({ includeHidden: true });
    const usedBy = units
      .map(contentUnitToMaterial)
      .filter((material) => (material.topic || material.category || "") === name);

    if (usedBy.length) {
      return NextResponse.json(
        { error: `该专题下还有 ${usedBy.length} 份资料，请先修改这些资料的所属专题后再删除。` },
        { status: 409 }
      );
    }

    await deleteTopic(name);
    await deleteTopicPanoramaPlacements(name);
    return NextResponse.json(await topicPayload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除专题失败" }, { status: 400 });
  }
}
