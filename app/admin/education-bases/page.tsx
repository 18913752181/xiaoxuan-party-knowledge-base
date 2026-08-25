import Link from "next/link";
import EducationBaseManager from "@/components/admin/EducationBaseManager";

export default function EducationBasesAdminPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ed] px-5 py-10 text-[#2f3732] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-medium text-[#607d6d] hover:underline">返回后台</Link>
          <Link href="/api/education-bases" target="_blank" className="text-sm text-[#607d6d] hover:underline">查看小程序接口</Link>
        </div>
        <header className="mt-5 max-w-3xl">
          <p className="text-sm font-medium text-[#607d6d]">小程序内容管理</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">教育基地管理</h1>
          <p className="mt-3 text-sm leading-7 text-[#6d746f]">维护基地资料和地图位置。只有已发布的记录会通过接口进入小程序。</p>
        </header>
        <EducationBaseManager />
      </div>
    </main>
  );
}
