import { NextResponse } from "next/server";
import { applyAuthCookies, clearAuthCookies, getServerSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({
    user: { id: session.user.id, email: session.user.email || "" }
  });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}

