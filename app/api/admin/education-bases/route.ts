import { NextResponse } from "next/server";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  EDUCATION_BASE_SELECT,
  normalizeEducationBaseInput,
  type EducationBaseRow
} from "@/lib/education-bases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || "数据库操作失败");
  if (message.includes("education_bases") || message.includes("schema cache")) {
    return "教育基地数据表尚未建立，请先执行 supabase/012_education_bases.sql 并导入初始数据。";
  }
  return message;
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("education_bases")
      .select(EDUCATION_BASE_SELECT)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return withAuthCookies(check.session, NextResponse.json({ bases: data || [] }));
  } catch (error) {
    return withAuthCookies(check.session, NextResponse.json({ error: databaseError(error) }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const row = normalizeEducationBaseInput(body);
    const admin = getSupabaseAdmin();
    const { data: last, error: lastError } = await admin.from("education_bases").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
    if (lastError) throw lastError;
    const id = Number(last?.id || 0) + 1;
    const { data, error } = await admin.from("education_bases").insert({ id, ...row }).select(EDUCATION_BASE_SELECT).single();
    if (error) throw error;
    return withAuthCookies(check.session, NextResponse.json({ item: data }, { status: 201 }));
  } catch (error) {
    const status = error instanceof Error && error.message.includes("不能为空") ? 400 : 500;
    return withAuthCookies(check.session, NextResponse.json({ error: databaseError(error) }, { status }));
  }
}

export async function PUT(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "无效的基地 ID。" }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin.from("education_bases").select(EDUCATION_BASE_SELECT).eq("id", id).single();
    if (readError) throw readError;
    const row = normalizeEducationBaseInput(body, current as EducationBaseRow);
    const { data, error } = await admin.from("education_bases").update(row).eq("id", id).select(EDUCATION_BASE_SELECT).single();
    if (error) throw error;
    return withAuthCookies(check.session, NextResponse.json({ item: data }));
  } catch (error) {
    const message = databaseError(error);
    const status = message.includes("不能为空") || message.includes("经度") || message.includes("纬度") ? 400 : 500;
    return withAuthCookies(check.session, NextResponse.json({ error: message }, { status }));
  }
}

export async function DELETE(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "无效的基地 ID。" }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("education_bases").delete().eq("id", id);
    if (error) throw error;
    return withAuthCookies(check.session, NextResponse.json({ ok: true }));
  } catch (error) {
    return withAuthCookies(check.session, NextResponse.json({ error: databaseError(error) }, { status: 500 }));
  }
}
