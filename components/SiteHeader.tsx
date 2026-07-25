"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/library", label: "资料库" },
  { href: "/#submit-question", label: "提交问题" },
  { href: "/me", label: "我的" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#ddd6cc] bg-[#faf7f2]/94 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3 text-brand-ink" aria-label="宣知资料库首页">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#9a4650] text-lg font-semibold text-white">宣</span>
          <span>
            <span className="block text-lg font-semibold tracking-tight">宣知</span>
            <span className="block text-[11px] text-[#6f746f]">小宣资料库</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-neutral-600 lg:flex" aria-label="主导航">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="relative rounded-xl px-3 py-2 transition hover:bg-white hover:text-[#8d2f32]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl bg-[#9a4650] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7d3540]">登录</Link>
        </div>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#e8e4de] bg-white/95 px-3 py-2 text-center text-[11px] text-neutral-500 shadow-[0_-8px_24px_rgba(54,48,42,0.06)] backdrop-blur-xl lg:hidden" aria-label="移动端导航">
        <MobileNavItem href="/" label="首页" active={pathname === "/" && hash !== "#submit-question"} />
        <MobileNavItem href="/library" label="资料库" active={pathname === "/library" || pathname.startsWith("/materials/")} />
        <MobileNavItem href="/#submit-question" label="提交问题" active={pathname === "/" && hash === "#submit-question"} />
        <MobileNavItem href="/me" label="我的" active={pathname === "/me" || pathname.startsWith("/me/")} />
      </nav>
    </>
  );
}

function MobileNavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  const className = `flex items-center justify-center rounded-xl px-1 py-3 text-sm transition ${
    active
      ? "bg-[#f3e7e6] font-semibold text-[#9a4650]"
      : "text-neutral-500 hover:bg-[#f7f4ee] hover:text-[#9a4650]"
  }`;
  const content = <span>{label}</span>;
  return href.includes("#") ? <a href={href} className={className}>{content}</a> : <Link href={href} className={className}>{content}</Link>;
}
