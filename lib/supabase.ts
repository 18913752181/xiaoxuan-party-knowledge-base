import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const missingSupabaseEnv = [
  rawSupabaseUrl ? "" : "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKey ? "" : "NEXT_PUBLIC_SUPABASE_ANON_KEY"
].filter(Boolean);

export const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

export const hasSupabaseEnv =
  missingSupabaseEnv.length === 0 && Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function testSupabaseConnection() {
  if (missingSupabaseEnv.length > 0) {
    return {
      ok: false,
      message: `连接失败：缺少环境变量 ${missingSupabaseEnv.join(", ")}`
    };
  }

  if (!supabase) {
    return {
      ok: false,
      message: "连接失败：Supabase client 未创建。请检查 URL 和 anon key。"
    };
  }

  const sessionResult = await Promise.race([
    supabase.auth.getSession(),
    new Promise<{ error: Error }>((resolve) => {
      window.setTimeout(() => {
        resolve({ error: new Error("请求超时，请检查网络或 Supabase 配置。") });
      }, 8000);
    })
  ]);

  const { error } = sessionResult;

  if (error) {
    return {
      ok: false,
      message: `连接失败：${error.message}`
    };
  }

  return {
    ok: true,
    message: "连接成功"
  };
}
