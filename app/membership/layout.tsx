import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "年度会员",
  description: "开通小宣资料库年度会员，在有效期内下载会员专属资料与工作模板。",
  alternates: { canonical: "/membership" },
  openGraph: {
    title: "年度会员 | 小宣资料库",
    description: "解锁会员专属资料与工作模板。",
    url: "/membership"
  }
};

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
