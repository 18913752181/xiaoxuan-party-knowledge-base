import type { CSSProperties } from "react";

export const AVATAR_OPTIONS = [
  { key: "terracotta", name: "陶土", background: "#B8644B", fur: "#FFF0D1", detail: "#46352F" },
  { key: "mist", name: "雾蓝", background: "#A5BBC8", fur: "#FFF8E9", detail: "#394953" },
  { key: "moss", name: "苔绿", background: "#62806F", fur: "#F8E8C8", detail: "#2B4138" },
  { key: "plum", name: "梅紫", background: "#80607B", fur: "#FFE6C9", detail: "#3B3040" },
  { key: "sky", name: "晴蓝", background: "#5B78B8", fur: "#EDF6F4", detail: "#283D6D" },
  { key: "amber", name: "琥珀", background: "#C99535", fur: "#FFF0D3", detail: "#513B22" }
] as const;

export type AvatarKey = (typeof AVATAR_OPTIONS)[number]["key"];

const FALLBACK_AVATAR_KEY: AvatarKey = "mist";

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result);
}

export function isAvatarKey(value?: string | null): value is AvatarKey {
  return AVATAR_OPTIONS.some((avatar) => avatar.key === value);
}

export function resolveAvatarKey(userId?: string, savedKey?: string | null): AvatarKey {
  if (isAvatarKey(savedKey)) return savedKey;
  if (!userId) return FALLBACK_AVATAR_KEY;
  return AVATAR_OPTIONS[hash(userId) % AVATAR_OPTIONS.length].key;
}

type ProfileAvatarProps = {
  userId?: string;
  avatarKey?: string | null;
  size?: number;
  className?: string;
  title?: string;
};

/**
 * 全部头像共享完全相同的圆润小猫轮廓；只更换三色配色。
 * 不依赖图片文件，在任意尺寸下都保持清晰。
 */
export function ProfileAvatar({ userId, avatarKey, size = 64, className = "", title = "用户头像" }: ProfileAvatarProps) {
  const key = resolveAvatarKey(userId, avatarKey);
  const palette = AVATAR_OPTIONS.find((avatar) => avatar.key === key) || AVATAR_OPTIONS[0];

  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
      width={size}
      height={size}
      className={`shrink-0 overflow-hidden rounded-[28%] ${className}`}
      style={{ "--avatar-bg": palette.background, "--avatar-fur": palette.fur, "--avatar-detail": palette.detail } as CSSProperties}
    >
      <rect width="96" height="96" rx="22" fill="var(--avatar-bg)" />
      <path
        d="M18 91V46.5c0-4.7 2-9 5.5-12L22 20.5c-.2-2.1 2.2-3.2 3.6-1.6L38 31.7a34 34 0 0 1 20 0l12.4-12.8c1.4-1.6 3.8-.5 3.6 1.6l-1.5 14c3.5 3 5.5 7.3 5.5 12V91H18Z"
        fill="var(--avatar-fur)"
      />
      <path d="M25.3 27.2 27 41.3l9.1-8.1-10.8-6Z" fill="var(--avatar-detail)" opacity=".14" />
      <path d="m70.7 27.2-1.7 14.1-9.1-8.1 10.8-6Z" fill="var(--avatar-detail)" opacity=".14" />
      <ellipse cx="37" cy="56" rx="3.9" ry="5.6" fill="var(--avatar-detail)" />
      <ellipse cx="59" cy="56" rx="3.9" ry="5.6" fill="var(--avatar-detail)" />
      <path d="M45.5 67.3c1.6 1.4 3.4 1.4 5 0" fill="none" stroke="var(--avatar-detail)" strokeLinecap="round" strokeWidth="2.6" />
      <path d="M45.8 63.2h4.4c.8 0 1.2 1 .6 1.6L48 67l-2.8-2.2c-.6-.6-.2-1.6.6-1.6Z" fill="var(--avatar-detail)" />
    </svg>
  );
}
