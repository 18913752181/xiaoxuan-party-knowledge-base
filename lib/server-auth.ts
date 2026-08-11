import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const ACCESS_COOKIE = "xx_access_token";
export const REFRESH_COOKIE = "xx_refresh_token";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
};

function authHeaders(accessToken?: string) {
  return {
    apikey: supabaseAnonKey,
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
}

export function authIsConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * 记录一次登录事件到 public.logins（数据统计用）。
 * 用用户自己的 access token 写入，RLS 校验 auth.uid() = user_id。
 * 失败静默忽略，绝不影响登录主流程。
 */
export async function recordLoginEvent(accessToken: string, userId: string) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !accessToken || !userId) return;
    await fetch(`${supabaseUrl}/rest/v1/logins`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ user_id: userId }),
      cache: "no-store"
    });
  } catch {
    // 统计写入失败不影响登录。
  }
}

export async function authFetch(path: string, init: RequestInit = {}) {
  // 15 秒超时：邮件服务（SMTP）偶发慢响应，绝不能让请求无限挂起
  return fetch(`${supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {})
    },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15000)
  });
}

export function applyAuthCookies(response: NextResponse, tokens: AuthTokens) {
  const secure = process.env.NODE_ENV === "production";
  const shared = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/"
  };

  response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    ...shared,
    maxAge: Math.max(60, tokens.expires_in || 3600)
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...shared,
    maxAge: SESSION_MAX_AGE
  });
}

export function clearAuthCookies(response: NextResponse) {
  const shared = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0
  };
  response.cookies.set(ACCESS_COOKIE, "", shared);
  response.cookies.set(REFRESH_COOKIE, "", shared);
}

async function getUser(accessToken: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: authHeaders(accessToken),
    cache: "no-store"
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ id: string; email?: string }>;
}

// Refresh-token single-flight + rotation grace cache.
//
// A page load fires several API routes concurrently; when the access cookie has
// expired they all race to redeem the same refresh token. Supabase rotates
// refresh tokens, so only the first call can win — the losers used to receive
// 401 and the session route then wiped the cookies, logging the user out.
// Keying the in-flight refresh by token makes every concurrent caller share one
// redemption, and the grace cache hands the rotated tokens to any straggler
// that still presents the previous refresh token (e.g. a second browser tab).
const ROTATION_GRACE_MS = 60_000;
const refreshInflight = new Map<string, Promise<AuthTokens | null>>();
const rotatedFromToken = new Map<string, { tokens: AuthTokens; at: number }>();

function sweepRotationCache() {
  const now = Date.now();
  rotatedFromToken.forEach((entry, token) => {
    if (now - entry.at > ROTATION_GRACE_MS) rotatedFromToken.delete(token);
  });
}

async function redeemRefreshToken(refreshToken: string): Promise<AuthTokens | null> {
  const rotated = rotatedFromToken.get(refreshToken);
  if (rotated && Date.now() - rotated.at <= ROTATION_GRACE_MS) return rotated.tokens;

  const inflight = refreshInflight.get(refreshToken);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const refreshResponse = await authFetch("/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!refreshResponse.ok) return null;

      const tokens = (await refreshResponse.json()) as AuthTokens;
      if (!tokens.access_token || !tokens.refresh_token || !tokens.user) return null;

      sweepRotationCache();
      rotatedFromToken.set(refreshToken, { tokens, at: Date.now() });
      return tokens;
    } catch {
      return null;
    }
  })();

  refreshInflight.set(refreshToken, task);
  try {
    return await task;
  } finally {
    if (refreshInflight.get(refreshToken) === task) refreshInflight.delete(refreshToken);
  }
}

export async function getServerSession() {
  if (!authIsConfigured()) return null;

  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value || "";
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value || "";

  if (accessToken) {
    const user = await getUser(accessToken);
    if (user && refreshToken) {
      // Re-issue both HttpOnly cookies after an authenticated request. This gives
      // the refresh cookie a rolling 30-day lifetime without exposing either
      // token to browser JavaScript.
      return {
        user,
        accessToken,
        refreshedTokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          user
        } as AuthTokens
      };
    }
    if (user) return { user, accessToken, refreshedTokens: null as AuthTokens | null };
  }

  if (!refreshToken) return null;

  const tokens = await redeemRefreshToken(refreshToken);
  if (!tokens) return null;

  return {
    user: tokens.user!,
    accessToken: tokens.access_token,
    refreshedTokens: tokens
  };
}
