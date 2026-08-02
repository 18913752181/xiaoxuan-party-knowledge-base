import { notFound } from "next/navigation";
import SupabaseTestClient from "./SupabaseTestClient";

/**
 * Supabase 连接调试页，仅用于本地开发。
 * 生产环境下直接返回 404，避免对外暴露环境变量与连接状态。
 */
export default function SupabaseTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SupabaseTestClient />;
}
