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
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
    const timedOut = name === "TimeoutError" || cause?.code === "UND_ERR_CONNECT_TIMEOUT" || cause?.code === "ETIMEDOUT";
    // Do not log email addresses, credentials or upstream response bodies.
    console.error("OTP request failed", { name, code: cause?.code });
    return NextResponse.json(
      { error: timedOut ? "邮件服务响应超时，请稍后重试。" : "登录服务暂时无法连接，请稍后重试。" },
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

