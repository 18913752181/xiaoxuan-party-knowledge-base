import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "小宣资料库｜党建资料下载", template: "%s" },
  description: "整理常用党建资料、制度文件和工作模板，支持分类查找、收藏与下载。",
  openGraph: {
    title: "小宣资料库｜党建资料下载",
    description: "查找、收藏和下载常用党建资料。",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans antialiased">
        <AppShell>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </AppShell>
      </body>
    </html>
  );
}
