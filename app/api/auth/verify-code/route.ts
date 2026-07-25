import { NextResponse } from "next/server";
import { applyAuthCookies, authFetch, authIsConfigured } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authIsConfigured()) {
    return NextResponse.json({ error: "登录服务暂未配置。" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const token = String(body.token || "").trim();
  if (!email || !/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: "请输入邮箱和6位验证码。" }, { status: 400 });
  }

  const authResponse = await authFetch("/verify", {
    method: "POST",
    body: JSON.stringify({ email, token, type: "email" })
  });

  if (!authResponse.ok) {
    const error = await authResponse.json().catch(() => ({}));
    return NextResponse.json(
      { error: error.msg || error.message || "验证码错误或已失效。" },
      { status: authResponse.status }
    );
  }

  const tokens = await authResponse.json();
  const response = NextResponse.json({
    ok: true,
    user: { id: tokens.user?.id, email: tokens.user?.email }
  });
  applyAuthCookies(response, tokens);
  return response;
}

