import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    // Do NOT clear the cookies here: a transient Supabase error or a refresh
    // race with a parallel request must not destroy an otherwise valid login.
    // Cookies are only cleared by the explicit logout route.
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const response = NextResponse.json({
    user: { id: session.user.id, email: session.user.email || "" }
  });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}

