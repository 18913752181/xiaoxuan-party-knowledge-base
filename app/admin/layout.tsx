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

  const profile = await getMembership(session.user.id).catch(() => null);
  if (!profile?.is_admin) redirect("/");

  return <>{children}</>;
}
