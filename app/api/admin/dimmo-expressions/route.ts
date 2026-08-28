import { NextResponse } from "next/server";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  DIMMO_EXPRESSION_SELECT,
  normalizeDimmoExpressionInput,
  type DimmoExpressionRow
} from "@/lib/dimmo-expressions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || "数据库操作失败");
  if (message.includes("dimmo_expressions") || message.includes("schema cache")) {
    return "Dimmo 表情库数据表尚未建立，请先执行 supabase/014_dimmo_expressions.sql。";
  }
  if (message.includes("duplicate key") || message.includes("dimmo_expressions_slug_key")) return "英文标识已被使用，请换一个。";
  return message;
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("dimmo_expressions")
      .select(DIMMO_EXPRESSION_SELECT)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return withAuthCookies(check.session, NextResponse.json({ expressions: data || [] }));
  } catch (error) {
    return withAuthCookies(check.session, NextResponse.json({ error: databaseError(error) }, { status: 500 }));
  }
}
export async function POST(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const row = normalizeDimmoExpressionInput(body);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("dimmo_expressions").insert(row).select(DIMMO_EXPRESSION_SELECT).single();
    if (error) throw error;
    return withAuthCookies(check.session, NextResponse.json({ item: data }, { status: 201 }));
  } catch (error) {
    const message = databaseError(error);
    const status = /不能为空|英文标识|请上传/.test(message) ? 400 : 500;
    return withAuthCookies(check.session, NextResponse.json({ error: message }, { status }));
  }
}

export async function PUT(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "无效的表情 ID。" }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin.from("dimmo_expressions").select(DIMMO_EXPRESSION_SELECT).eq("id", id).single();
    if (readError) throw readError;
    const row = normalizeDimmoExpressionInput(body, current as DimmoExpressionRow);
    const { data, error } = await admin.from("dimmo_expressions").update(row).eq("id", id).select(DIMMO_EXPRESSION_SELECT).single();
    if (error) throw error;
    const oldPath = (current as DimmoExpressionRow).storage_path;
    if (oldPath && oldPath !== row.storage_path) await admin.storage.from("dimmo-expressions").remove([oldPath]).catch(() => null);
    return withAuthCookies(check.session, NextResponse.json({ item: data }));
  } catch (error) {
    const message = databaseError(error);
    const status = /不能为空|英文标识|请上传/.test(message) ? 400 : 500;
    return withAuthCookies(check.session, NextResponse.json({ error: message }, { status }));
  }
}

export async function DELETE(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "无效的表情 ID。" }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin.from("dimmo_expressions").select("storage_path").eq("id", id).maybeSingle();
    if (readError) throw readError;
    const { error } = await admin.from("dimmo_expressions").delete().eq("id", id);
    if (error) throw error;
    if (current?.storage_path) await admin.storage.from("dimmo-expressions").remove([current.storage_path]).catch(() => null);
    return withAuthCookies(check.session, NextResponse.json({ ok: true }));
  } catch (error) {
    return withAuthCookies(check.session, NextResponse.json({ error: databaseError(error) }, { status: 500 }));
  }
}
