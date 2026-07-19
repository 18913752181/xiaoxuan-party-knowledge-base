import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "宣知党建｜基层党建工作平台", template: "%s" },
  description: "面向基层党务工作者，按工作事项查制度、看流程、找清单和模板，把复杂的党务工作一步一步做清楚。",
  openGraph: {
    title: "宣知党建｜基层党建工作平台",
    description: "查制度、看流程、找模板，把党建工作一步一步做清楚。",
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
