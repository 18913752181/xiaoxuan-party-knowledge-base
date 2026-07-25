import { NextResponse } from "next/server";
import { ACCESS_COOKIE, authFetch, clearAuthCookies } from "@/lib/server-auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    await authFetch("/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
