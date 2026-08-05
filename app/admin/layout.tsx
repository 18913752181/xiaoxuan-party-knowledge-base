import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { getMembership } from "@/lib/membership";

export const dynamic = "force-dynamic";

/**
 * 后台管理页面的服务端守卫：
 * 未登录跳转到登录页（登录后回跳 /admin），非管理员跳回首页。
 * 注意：真正的安全边界在 /api/admin/* 接口的 requireAdmin 校验，
 * 这里只是避免普通用户看到后台界面。
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login?redirect=/admin");

  // 后台页面应使用当前登录用户的 access token 查询其自身权限。
  // 这样本地开发环境未配置服务端密钥时，管理员仍可正常进入后台；
  // 服务端 API 仍会在各自的 requireAdmin 守卫中再次校验权限。
  const profile = await getMembership(session.user.id, session.accessToken).catch(() => null);
  if (!profile?.is_admin) redirect("/");

  return <>{children}</>;
}
