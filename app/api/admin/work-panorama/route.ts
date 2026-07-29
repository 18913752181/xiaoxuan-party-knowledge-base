import { NextResponse } from "next/server";
import {
  addWorkLevel,
  addWorkSection,
  deleteWorkLevel,
  deleteWorkSection,
  getWorkLevels,
  updateWorkLevel,
  updateWorkSection,
} from "@/lib/work-panorama-store";
import {
  removePanoramaLevel,
  removePanoramaSection,
  renamePanoramaSection,
} from "@/lib/topic-panorama";

async function payload() {
  return { levels: await getWorkLevels() };
}

export async function GET() {
  return NextResponse.json(await payload());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.type === "section") await addWorkSection(String(body.level || ""), String(body.name || ""));
    else await addWorkLevel(body);
    return NextResponse.json(await payload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "新增失败" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (body.type === "section") {
      if (body.oldName !== body.name) {
        await renamePanoramaSection(String(body.level || ""), String(body.oldName || ""), String(body.name || ""));
      }
      await updateWorkSection(String(body.level || ""), String(body.oldName || ""), {
        name: String(body.name || ""),
        items: Array.isArray(body.items) ? body.items : [],
        keywords: Array.isArray(body.keywords) ? body.keywords : [],
      });
    } else {
      await updateWorkLevel(String(body.slug || ""), body);
    }
    return NextResponse.json(await payload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "修改失败" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (body.type === "section") {
      await removePanoramaSection(String(body.level || ""), String(body.name || ""));
      await deleteWorkSection(String(body.level || ""), String(body.name || ""));
    } else {
      await removePanoramaLevel(String(body.slug || ""));
      await deleteWorkLevel(String(body.slug || ""));
    }
    return NextResponse.json(await payload());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 400 });
  }
}
