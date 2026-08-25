import { NextResponse } from "next/server";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getFallbackEducationBases } from "@/lib/education-bases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const admin = getSupabaseAdmin();
    const { count, error: countError } = await admin.from("education_bases").select("id", { count: "exact", head: true });
    if (countError) throw countError;
    if ((count || 0) > 0) {
      return withAuthCookies(check.session, NextResponse.json({ error: "数据库中已有基地，为避免覆盖现有编辑，已停止导入。" }, { status: 409 }));
    }
    const rows = getFallbackEducationBases().map(({ created_at, updated_at, ...item }) => item);
    const { error } = await admin.from("education_bases").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    return withAuthCookies(check.session, NextResponse.json({ ok: true, count: rows.length }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || "导入失败");
    return withAuthCookies(check.session, NextResponse.json({ error: message }, { status: 500 }));
  }
}
