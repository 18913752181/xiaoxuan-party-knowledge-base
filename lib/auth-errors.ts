"use client";

type SupabaseLikeError = {
  message?: string;
  code?: string;
  status?: number;
};

function friendlyAuthMessage(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("user already registered")) {
    return "该邮箱已注册，请直接登录";
  }
  if (lower.includes("password should be at least 6 characters")) {
    return "密码至少 6 位";
  }
  if (lower.includes("email not confirmed")) {
    return "邮箱未确认，请先完成邮箱验证或关闭邮箱确认";
  }
  if (lower.includes("invalid login credentials")) {
    return "邮箱或密码错误";
  }
  if (lower.includes("anonymous") && lower.includes("disabled")) {
    return "请在 Supabase Authentication → Providers 中开启 Anonymous Sign-ins";
  }
  if (lower.includes("same password")) {
    return "新密码不能和旧密码相同";
  }
  if (lower.includes("expired") || lower.includes("invalid")) {
    return "验证码可能已过期或无效，请重新发送验证码";
  }

  return "";
}

export function formatAuthError(prefix: string, error: SupabaseLikeError) {
  const message = error.message || "未知错误";
  const friendlyMessage = friendlyAuthMessage(message);
  const details = [
    friendlyMessage,
    `Supabase message：${message}`,
    error.code ? `Supabase code：${error.code}` : "",
    typeof error.status === "number" ? `Supabase status：${error.status}` : ""
  ].filter(Boolean);

  return `${prefix}：${details.join("；")}`;
}

