export const PASSWORD_RULE_MESSAGE = "密码至少 8 位，并且必须同时包含字母和数字。";

export function isValidPassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}
