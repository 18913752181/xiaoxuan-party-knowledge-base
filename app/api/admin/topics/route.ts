import { NextResponse } from "next/server";
import { addTopic, listTopics, renameTopic } from "@/lib/topics";

export async function GET() {
  try {
    return NextResponse.json({ topics: await listTopics() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取专题失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topics = await addTopic(String(body.name || ""));
    return NextResponse.json({ topics });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "新增专题失败" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const result = await renameTopic(String(body.oldName || ""), String(body.newName || ""));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "修改专题失败" }, { status: 400 });
  }
}
