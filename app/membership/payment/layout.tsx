import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "小宣资料库年卡" },
  description: "开通资料库年卡，有效期内可下载全站资料。",
  alternates: { canonical: "/membership/payment" },
  openGraph: {
    title: "小宣资料库年卡",
    description: "有效期内可单份或批量下载全站资料。",
    url: "/membership/payment"
  }
};

export default function MembershipPaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
