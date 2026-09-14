import Link from "next/link";
import TencentLocationReview from "@/components/admin/TencentLocationReview";

export default function EducationBaseLocationReviewPage() {
  return <main className="min-h-screen bg-[#f7f4ed] px-5 py-10 text-[#2f3732] sm:px-6 sm:py-12"><div className="mx-auto max-w-7xl"><Link href="/admin/education-bases" className="text-sm font-medium text-[#607d6d] hover:underline">返回基地管理</Link><header className="my-5 max-w-3xl"><p className="text-sm font-medium text-[#607d6d]">小程序内容管理</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">基地地址核验</h1><p className="mt-3 text-sm leading-7 text-[#6d746f]">腾讯位置服务只在服务器端调用。人工确认后，唯一正式位置仍是基地表的 address、latitude、longitude。</p></header><TencentLocationReview /></div></main>;
}
