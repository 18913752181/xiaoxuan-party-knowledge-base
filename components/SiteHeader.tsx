"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";

const navItems = [
  { href: "/", label: "工作台" },
  { href: "/library", label: "资料" },
  { href: "/dimmo", label: "Dimmo" },
  { href: "/me", label: "我的" }
];

function navItemActive(href: string, pathname: string, hash: string) {
  if (href === "/") return pathname === "/" && hash !== "#submit-question";
  if (href === "/library") return pathname === "/library" || pathname.startsWith("/materials/");
  if (href === "/dimmo") return pathname === "/dimmo";
  if (href === "/me") return pathname === "/me" || pathname.startsWith("/me/");
  return pathname === href;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [sessionProfile, setSessionProfile] = useState<{ id: string; email: string; avatar_key?: string | null } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  // 感知登录状态：已登录用户显示账号入口而不是“登录”按钮。
  useEffect(() => {
    let cancelled = false;
    const loadSessionProfile = () => fetch("/api/auth/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setSessionProfile(data?.profile || null);
        setSessionChecked(true);
      })
      .catch(() => {
        if (!cancelled) setSessionChecked(true);
      });
    loadSessionProfile();
    window.addEventListener("profile-avatar-updated", loadSessionProfile);
    return () => {
      cancelled = true;
      window.removeEventListener("profile-avatar-updated", loadSessionProfile);
    };
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-line bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight text-brand-ink" aria-label="喵喵工作台首页">
          喵喵工作台
        </Link>
        <nav className="hidden items-center gap-1 text-sm lg:flex" aria-label="主导航">
          {navItems.map((item) => {
            const active = navItemActive(item.href, pathname, hash);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-xl px-3 py-2 transition-[background-color,color,transform] duration-150 ${
                  active
                    ? "bg-[#fff1f2] font-semibold text-brand-red"
                    : "text-neutral-600 hover:bg-[#f1f3f5] hover:text-brand-red"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {sessionChecked && sessionProfile ? (
            <Link
              href="/me"
              className="rounded-2xl p-0.5 transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 active:scale-[0.97]"
              title="我的"
              aria-label="进入我的页面"
            >
              <ProfileAvatar userId={sessionProfile.id} avatarKey={sessionProfile.avatar_key} size={38} />
            </Link>
          ) : (
            <Link href="/login" className="rounded-xl bg-brand-red px-4 py-2 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-darkRed active:scale-[0.98]">登录</Link>
          )}
        </div>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-brand-line bg-white/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-center text-[11px] text-neutral-500 shadow-[0_-8px_24px_rgba(35,43,52,0.055)] backdrop-blur-xl lg:hidden" aria-label="移动端导航">
        <MobileNavItem href="/" label="工作台" active={pathname === "/"} />
        <MobileNavItem href="/library" label="资料" active={pathname === "/library" || pathname.startsWith("/materials/")} />
        <MobileNavItem href="/dimmo" label="Dimmo" active={pathname === "/dimmo"} />
        <MobileNavItem href="/me" label="我的" active={pathname === "/me" || pathname.startsWith("/me/")} />
      </nav>
    </>
  );
}

function MobileNavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  const className = `flex items-center justify-center rounded-xl px-1 py-3 text-sm transition-[background-color,color,transform] duration-150 active:scale-[0.98] ${
    active
      ? "bg-[#fff1f2] font-semibold text-brand-red"
      : "text-neutral-500 hover:bg-[#f1f3f5] hover:text-brand-red"
  }`;
  const content = <span>{label}</span>;
  if (href.includes("#")) {
    return (
      <a
        href={href}
        className={className}
        onClick={(event) => {
          if (window.location.pathname !== "/") return;

          const targetId = href.split("#")[1];
          const target = document.getElementById(targetId);
          if (!target) return;

          event.preventDefault();
          window.history.replaceState(null, "", href);
          window.dispatchEvent(new Event("hashchange"));
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        {content}
      </a>
    );
  }

  return <Link href={href} className={className}>{content}</Link>;
}
