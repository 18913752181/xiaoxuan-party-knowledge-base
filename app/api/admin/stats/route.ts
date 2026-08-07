import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { listContentUnits } from "@/lib/content-units";

export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const DAY_MS = 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;

type ProfileRow = {
  id: string;
  email: string | null;
  member_status: string;
  member_expires_at: string | null;
};

function userClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

/** 表还没建时返回空数组，统计页照常可用。 */
async function safeSelect(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  orderBy = "created_at"
): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order(orderBy, { ascending: false })
    .limit(2000);
  if (error) return [];
  return (data || []) as unknown as Row[];
}

/** 北京时间当日的起始时刻（ISO，带 +08:00 偏移）。 */
function shanghaiDayStart(offsetDays = 0) {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * DAY_MS);
  return `${shifted.toISOString().slice(0, 10)}T00:00:00.000+08:00`;
}

function parseDateParam(value: string | null, fallback: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000+08:00`;
  return fallback;
}

function countDistinct(rows: Row[], key: string) {
  return new Set(rows.map((row) => String(row[key] || "")).filter(Boolean)).size;
}

export async function GET(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  const supabase = userClient(check.session.accessToken);

  const url = new URL(request.url);
  const fromISO = parseDateParam(url.searchParams.get("from"), shanghaiDayStart(-29));
  const toISO = parseDateParam(url.searchParams.get("to"), shanghaiDayStart(0)).replace("T00:00:00", "T23:59:59");

  const [downloadRows, favoriteRows, loginRows, donationRows, profileRows, units] = await Promise.all([
    safeSelect(supabase, "downloads", "user_id,article_slug,title,created_at"),
    safeSelect(supabase, "favorites", "user_id,article_slug,title,category,created_at"),
    safeSelect(supabase, "logins", "user_id,created_at"),
    safeSelect(supabase, "donations", "user_id,amount_cents,source_slug,source_title,status,created_at"),
    safeSelect(supabase, "profiles", "id,email,member_status,member_expires_at", "created_at") as Promise<Row[]>,
    listContentUnits().catch(() => [])
  ]);

  const profiles = profileRows as unknown as ProfileRow[];
  const emailOf = new Map(profiles.map((p) => [p.id, p.email || "未知用户"]));
  const memberOf = new Map(profiles.map((p) => [p.id, p.member_status]));
  const todayStart = shanghaiDayStart(0);
  const last24h = new Date(Date.now() - DAY_MS).toISOString();
  const todayDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const inRange = (row: Row) => {
    const at = String(row.created_at || "");
    return at >= fromISO && at <= toISO;
  };

  // ---- 顶部数字 ----
  const downloadsTotal = units.reduce((sum, unit) => sum + (unit.meta.downloadCount || 0), 0);
  const downloadsToday = downloadRows.filter((row) => String(row.created_at) >= todayStart).length;
  const favoritesTotal = favoriteRows.length;
  const favoriteUsers = countDistinct(favoriteRows, "user_id");
  const loginUsers = countDistinct(loginRows, "user_id");
  const activeLoginUsers = countDistinct(
    loginRows.filter((row) => String(row.created_at) >= last24h),
    "user_id"
  );
  const membersTotal = profiles.filter((p) => p.member_status === "member").length;
  const membersActive = profiles.filter(
    (p) => p.member_status === "member" && p.member_expires_at && p.member_expires_at >= todayDate
  ).length;

  // ---- 明细（按时间范围） ----
  const downloadDetails = downloadRows.filter(inRange).slice(0, 200).map((row) => ({
    created_at: row.created_at,
    email: emailOf.get(String(row.user_id)) || "未知用户",
    title: row.title,
    article_slug: row.article_slug
  }));

  const favoriteDetails = favoriteRows.filter(inRange).slice(0, 200).map((row) => ({
    created_at: row.created_at,
    email: emailOf.get(String(row.user_id)) || "未知用户",
    title: row.title,
    article_slug: row.article_slug,
    active: true // 收藏表只保留当前有效收藏，取消即删行
  }));

  const loginDetails = loginRows.filter(inRange).slice(0, 200).map((row) => ({
    created_at: row.created_at,
    email: emailOf.get(String(row.user_id)) || "未知用户",
    member_status: memberOf.get(String(row.user_id)) || "free"
  }));

  const donationDetails = donationRows.filter(inRange).slice(0, 200).map((row) => ({
    created_at: row.created_at,
    email: emailOf.get(String(row.user_id)) || "未知用户",
    amount_cents: row.amount_cents,
    source_title: row.source_title,
    status: row.status
  }));

  // ---- 排行 TOP10 ----
  const downloadRanking = units
    .map((unit) => ({ title: unit.meta.title, slug: unit.slug, count: unit.meta.downloadCount || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const favoriteCountMap = new Map<string, { title: string; count: number }>();
  for (const row of favoriteRows) {
    const slug = String(row.article_slug || "");
    const entry = favoriteCountMap.get(slug) || { title: String(row.title || slug), count: 0 };
    entry.count += 1;
    favoriteCountMap.set(slug, entry);
  }
  const favoriteRanking = Array.from(favoriteCountMap, ([slug, entry]) => ({ slug, title: entry.title, count: entry.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const donationAmountMap = new Map<string, { title: string; amount: number }>();
  for (const row of donationRows) {
    if (row.status !== "paid") continue;
    const slug = String(row.source_slug || "site");
    const entry = donationAmountMap.get(slug) || { title: String(row.source_title || "全站支持"), amount: 0 };
    entry.amount += Number(row.amount_cents || 0);
    donationAmountMap.set(slug, entry);
  }
  const donationRanking = Array.from(donationAmountMap, ([slug, entry]) => ({ slug, title: entry.title, amount_cents: entry.amount }))
    .sort((a, b) => b.amount_cents - a.amount_cents)
    .slice(0, 10);

  return withAuthCookies(check.session, NextResponse.json({
    range: { from: fromISO.slice(0, 10), to: toISO.slice(0, 10) },
    tiles: {
      downloadsTotal,
      downloadsToday,
      favoritesTotal,
      favoriteUsers,
      loginUsers,
      activeLoginUsers,
      membersActive,
      membersTotal
    },
    details: {
      downloads: downloadDetails,
      favorites: favoriteDetails,
      logins: loginDetails,
      donations: donationDetails
    },
    rankings: {
      downloads: downloadRanking,
      favorites: favoriteRanking,
      donations: donationRanking
    }
  }));
}
