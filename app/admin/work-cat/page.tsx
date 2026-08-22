import Image from "next/image";
import Link from "next/link";
import WorkCatDashboard from "@/components/admin/WorkCatDashboard";

export default function WorkCatPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-5 py-10 text-[#1b1f24] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm text-[#637a70] hover:underline">返回后台</Link>
        <header className="mt-5 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#eef1f0]"><Image src="/images/dimmo-default-transparent.png" alt="Dimmo 工作小猫" fill className="object-contain p-1" /></div>
          <div><p className="text-sm font-medium text-[#637a70]">喵喵工作台</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">工作小猫</h1><p className="mt-2 text-sm text-[#68727d]">Dimmo 的接待记录、专业问题转交和留言待办。</p></div>
        </header>
        <WorkCatDashboard />
      </div>
    </main>
  );
}
