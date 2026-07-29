import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function membershipIsActive(status?: string | null, expiresAt?: string | null) {
  if (status !== "member" || !expiresAt) return false;
  return expiresAt >= new Date().toISOString().slice(0, 10);
}

export async function getMembership(userId: string, accessToken?: string) {
  if (accessToken) {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!baseUrl || !anonKey) throw new Error("Supabase 环境变量未配置。");
    const response = await fetch(
      `${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=member_status,member_expires_at,is_admin`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.pgrst.object+json"
        },
        cache: "no-store"
      }
    );
    if (!response.ok) throw new Error("无法读取会员状态。");
    const data = await response.json();
    return {
      ...data,
      active: membershipIsActive(data.member_status, data.member_expires_at)
    };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("member_status, member_expires_at, is_admin")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    active: membershipIsActive(data.member_status, data.member_expires_at)
  };
}
