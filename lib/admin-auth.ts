import "server-only";

import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getMembership } from "@/lib/membership";

type Session = NonNullable<Awaited<ReturnType<typeof getServerSession>>>;

export type AdminCheck =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/**
 * 管理接口统一鉴权：要求已登录且 profiles.is_admin 为 true。
 * 用法：
 *   const check = await requireAdmin();
 *   if (!check.ok) return check.response;
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const session = await getServerSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "请先登录。" }, { status: 401 })
    };
  }

  try {
    // 用当前会话令牌读取用户自己的 profiles 记录，避免把后台登录
    // 错误地绑定到仅生产环境才需要的 SUPABASE_SERVICE_ROLE_KEY。
    const profile = await getMembership(session.user.id, session.accessToken);
    if (!profile.is_admin) {
      return {
        ok: false,
        response: NextResponse.json({ error: "无权访问管理接口。" }, { status: 403 })
      };
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "无法验证管理员权限。" }, { status: 500 })
    };
  }

  return { ok: true, session };
}

/** 会话若发生了 token 刷新，把新令牌写回响应 Cookie，避免刷新令牌失效。 */
export function withAuthCookies(session: Session, response: NextResponse): NextResponse {
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}

/**
 * 高阶包装：为整个 handler 加上管理员鉴权，并在成功后回写刷新后的令牌。
 * 用法：export const GET = withAdmin(async () => { ... });
 */
export function withAdmin<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    const check = await requireAdmin();
    if (!check.ok) return check.response;
    const response = await handler(...args);
    return withAuthCookies(check.session, response);
  };
}
