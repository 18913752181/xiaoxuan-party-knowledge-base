import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "喵喵工作台会员" },
  description: "开通喵喵工作台会员，使用会员专属资料与工作工具。",
  alternates: { canonical: "/membership/payment" },
  openGraph: {
    title: "喵喵工作台会员",
    description: "开通会员，使用专属资料与工作工具。",
    url: "/membership/payment"
  }
};

export default function MembershipPaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
