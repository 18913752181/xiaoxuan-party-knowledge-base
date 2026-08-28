import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;
type ExportType = "downloads" | "favorites" | "logins" | "donations";

function userClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

/** 分页读取，导出不受统计页明细条数限制。 */
async function selectAll(supabase: SupabaseClient, table: string, columns: string, orderBy = "created_at"): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`读取${table}数据失败。`);
    const batch = (data || []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

function parseDateParam(value: string | null, fallback: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000+08:00`;
  return fallback;
}

function getDateRange(request: Request) {
  const url = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);
  const from = parseDateParam(url.searchParams.get("from"), `${defaultFrom}T00:00:00.000+08:00`);
  const to = parseDateParam(url.searchParams.get("to"), `${defaultTo}T23:59:59.999+08:00`).replace("T00:00:00.000", "T23:59:59.999");
  return { from, to };
}

function inRange(row: Row, from: string, to: string) {
  const createdAt = String(row.created_at || "");
  return createdAt >= from && createdAt <= to;
}

/** 避免用户输入被 Excel 当作公式执行。 */
function safeCell(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function formatTime(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
}

export async function GET(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const type = new URL(request.url).searchParams.get("type") as ExportType;
  if (!(["downloads", "favorites", "logins", "donations"] as ExportType[]).includes(type)) {
    return withAuthCookies(check.session, NextResponse.json({ error: "不支持的导出类型。" }, { status: 400 }));
  }

  try {
    const supabase = userClient(check.session.accessToken);
    const { from, to } = getDateRange(request);
    const [profiles, sourceRows] = await Promise.all([
      selectAll(supabase, "profiles", "id,email,member_status", "created_at"),
      type === "downloads"
        ? selectAll(supabase, "downloads", "user_id,article_slug,title,created_at")
        : type === "favorites"
          ? selectAll(supabase, "favorites", "user_id,article_slug,title,created_at")
          : type === "logins"
            ? selectAll(supabase, "logins", "user_id,created_at")
            : selectAll(supabase, "donations", "user_id,amount_cents,source_title,status,created_at")
    ]);
    const emailOf = new Map(profiles.map((row) => [String(row.id), String(row.email || "未知用户")]));
    const memberOf = new Map(profiles.map((row) => [String(row.id), String(row.member_status || "free")]));
    const rows = sourceRows.filter((row) => inRange(row, from, to));

    const sheets = {
      downloads: {
        name: "下载明细",
        headers: ["时间", "用户", "资料名称", "资料标识"],
        values: rows.map((row) => [formatTime(row.created_at), emailOf.get(String(row.user_id)) || "未知用户", row.title, row.article_slug])
      },
      favorites: {
        name: "收藏明细",
        headers: ["时间", "用户", "资料名称", "资料标识", "当前是否收藏"],
        values: rows.map((row) => [formatTime(row.created_at), emailOf.get(String(row.user_id)) || "未知用户", row.title, row.article_slug, "是"])
      },
      logins: {
        name: "登录明细",
        headers: ["时间", "用户", "会员状态"],
        values: rows.map((row) => [formatTime(row.created_at), emailOf.get(String(row.user_id)) || "未知用户", memberOf.get(String(row.user_id)) === "member" ? "会员" : "免费"])
      },
      donations: {
        name: "赞赏明细",
        headers: ["时间", "用户", "赞赏金额（元）", "来源资料", "支付状态"],
        values: rows.map((row) => [formatTime(row.created_at), emailOf.get(String(row.user_id)) || "未知用户", (Number(row.amount_cents || 0) / 100).toFixed(2), row.source_title || "全站支持", row.status])
      }
    }[type];

    const worksheet = XLSX.utils.aoa_to_sheet([sheets.headers, ...sheets.values.map((row) => row.map(safeCell))]);
    worksheet["!cols"] = sheets.headers.map((header, index) => ({ wch: Math.min(48, Math.max(14, header.length * 2 + (index === 2 ? 22 : 8))) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheets.name);
    const body = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true });
    const fileName = `小宣资料库-${sheets.name}-${from.slice(0, 10)}至${to.slice(0, 10)}.xlsx`;
    const response = new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store"
      }
    });
    return withAuthCookies(check.session, response);
  } catch (error) {
    return withAuthCookies(check.session, NextResponse.json({ error: error instanceof Error ? error.message : "导出失败，请稍后重试。" }, { status: 500 }));
  }
}
