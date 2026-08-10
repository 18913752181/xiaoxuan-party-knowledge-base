"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Material } from "@/lib/types";
import { getArticleSlug } from "@/lib/favorites";

const DISMISS_KEY = "xiaoxuan_support_dismissed_v1";
const LAST_SHOWN_KEY = "xiaoxuan_support_last_shown";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天内最多提示 1 次

export function supportCardDismissed() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

/**
 * 频率控制：点过「暂时不用」的用户永不提示；其余用户 7 天内最多看到 1 次。
 * 会员与非会员一视同仁，均可自愿赞赏。
 */
export function shouldShowSupportCard() {
  if (typeof window === "undefined") return false;
  if (supportCardDismissed()) return false;
  const lastShown = Number(window.localStorage.getItem(LAST_SHOWN_KEY) || 0);
  return Date.now() - lastShown > SNOOZE_MS;
}

function markSupportCardShown() {
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    // 忽略存储失败
  }
}

/**
 * 下载成功后展示的「支持小宣」轻量卡片。
 * 完全自愿：点「暂时不用」后关闭且不再出现。
 */
export default function SupportCard({ material, onClose }: { material: Material; onClose: () => void }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 入场动画 + 记录展示时间（7 天频率控制生效点）。
    markSupportCardShown();
    const timer = window.setTimeout(() => setVisible(true), 50);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 忽略存储失败
    }
    onClose();
  }

  function goSupport() {
    const slug = getArticleSlug(material);
    router.push(`/support?from=${encodeURIComponent(slug)}&title=${encodeURIComponent(material.title)}`);
  }

  return (
    <div
      className={`mt-4 overflow-hidden rounded-2xl border border-[#ead9c2] bg-[#fdf9f2] transition-all duration-300 ${
        visible ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
      }`}
      role="complementary"
      aria-label="支持小宣"
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7a5c3a]">
            如果这份资料对你有帮助，也欢迎自愿支持小宣继续整理更多实用内容 ☕️
          </p>
          <p className="mt-1 text-xs text-[#a08d72]">赞赏完全自愿，不影响资料下载和任何会员权益。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl px-4 py-2 text-sm text-[#a08d72] transition hover:bg-[#f3ece0]"
          >
            暂时不用
          </button>
          <button
            type="button"
            onClick={goSupport}
            className="rounded-xl bg-[#c98a4b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b67a3e]"
          >
            支持小宣 ☕️
          </button>
        </div>
      </div>
    </div>
  );
}
