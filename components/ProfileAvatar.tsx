import Image from "next/image";

export const AVATAR_OPTIONS = [
  { key: "fox", name: "小狐狸", src: "/images/avatars/avatar-fox.webp" },
  { key: "dog", name: "小狗", src: "/images/avatars/avatar-dog.webp" },
  { key: "robot", name: "小机器人", src: "/images/avatars/avatar-robot.webp" },
  { key: "elephant", name: "小象", src: "/images/avatars/avatar-elephant.webp" },
  { key: "acorn", name: "小橡果", src: "/images/avatars/avatar-acorn.webp" },
  { key: "bear", name: "小熊", src: "/images/avatars/avatar-bear.webp" },
  { key: "whale", name: "小鲸鱼", src: "/images/avatars/avatar-whale.webp" },
  { key: "panda", name: "小熊猫", src: "/images/avatars/avatar-panda.webp" },
  { key: "mushroom", name: "小蘑菇", src: "/images/avatars/avatar-mushroom.webp" },
  { key: "cream-blob", name: "奶油团子", src: "/images/avatars/avatar-cream-blob.webp" },
  { key: "shadow-blob", name: "黑团子", src: "/images/avatars/avatar-shadow-blob.webp" },
  { key: "cowboy", name: "牛仔小人", src: "/images/avatars/avatar-cowboy.webp" }
] as const;

export type AvatarKey = (typeof AVATAR_OPTIONS)[number]["key"];

const FALLBACK_AVATAR_KEY: AvatarKey = "fox";
const DEFAULT_AVATAR_KEYS: AvatarKey[] = ["fox", "dog", "bear", "whale", "panda", "mushroom", "cream-blob", "shadow-blob"];

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(result);
}

export function isAvatarKey(value?: string | null): value is AvatarKey {
  return AVATAR_OPTIONS.some((avatar) => avatar.key === value);
}

export function resolveAvatarKey(userId?: string, savedKey?: string | null): AvatarKey {
  if (isAvatarKey(savedKey)) return savedKey;
  if (!userId) return FALLBACK_AVATAR_KEY;
  return DEFAULT_AVATAR_KEYS[hash(userId) % DEFAULT_AVATAR_KEYS.length];
}

type ProfileAvatarProps = {
  userId?: string;
  avatarKey?: string | null;
  size?: number;
  className?: string;
  title?: string;
};

/** 直接使用 ip-as-logo 参考图中的独立角色，首次登录按用户 ID 稳定随机分配。 */
export function ProfileAvatar({ userId, avatarKey, size = 64, className = "", title = "用户头像" }: ProfileAvatarProps) {
  const key = resolveAvatarKey(userId, avatarKey);
  const avatar = AVATAR_OPTIONS.find((item) => item.key === key) || AVATAR_OPTIONS[0];

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-[28%] bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={avatar.src}
        alt={title}
        fill
        sizes={`${size}px`}
        className="scale-[1.07] object-cover"
        priority={size >= 64}
      />
    </span>
  );
}
