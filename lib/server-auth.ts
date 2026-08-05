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

export async function authFetch(path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {})
    },
    cache: "no-store"
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

  const refreshResponse = await authFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  if (!refreshResponse.ok) return null;

  const tokens = (await refreshResponse.json()) as AuthTokens;
  if (!tokens.access_token || !tokens.refresh_token || !tokens.user) return null;

  return {
    user: tokens.user,
    accessToken: tokens.access_token,
    refreshedTokens: tokens
  };
}
