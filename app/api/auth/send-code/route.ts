import { NextResponse } from "next/server";
import { authFetch, authIsConfigured } from "@/lib/server-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authIsConfigured()) {
    return NextResponse.json({ error: "登录服务暂未配置。" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "请输入邮箱地址。" }, { status: 400 });

  // 双重限流：同一邮箱 5 分钟内最多 3 次，同一 IP 10 分钟内最多 10 次。
  if (
    !rateLimit(`send-code:email:${email}`, 3, 5 * 60 * 1000) ||
    !rateLimit(`send-code:ip:${clientIp(request)}`, 10, 10 * 60 * 1000)
  ) {
    return NextResponse.json({ error: "验证码请求太频繁，请稍后再试。" }, { status: 429 });
  }

  let authResponse: Response;
  try {
    authResponse = await authFetch("/otp", {
      method: "POST",
      body: JSON.stringify({ email, create_user: true })
    });
  } catch {
    // 邮件服务超时或网络异常（authFetch 15 秒超时），给前端明确错误而不是无限“发送中”
    return NextResponse.json(
      { error: "邮件服务响应超时，请稍后重试。" },
      { status: 503 }
    );
  }

  if (!authResponse.ok) {
    const error = await authResponse.json().catch(() => ({}));
    return NextResponse.json(
      { error: error.msg || error.message || "验证码发送失败。" },
      { status: authResponse.status }
    );
  }

  return NextResponse.json({ ok: true });
}

