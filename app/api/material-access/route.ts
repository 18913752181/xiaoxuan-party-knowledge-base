import { NextResponse } from "next/server";
import { getServerSession, applyAuthCookies } from "@/lib/server-auth";
import { authorizeMaterialAccess } from "@/lib/material-access";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getServerSession();
  let response: NextResponse;
  try {
    response = session ? NextResponse.json(await authorizeMaterialAccess(session.accessToken, null, false, session.user.id))
      : NextResponse.json({ error: "请先登录。" }, { status: 401 });
  } catch {
    response = NextResponse.json({ error: "资料权限暂时无法核验，请稍后重试。" }, { status: 503 });
  }
  response.headers.set("Cache-Control", "private, no-store");
  if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
