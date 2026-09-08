import Link from "next/link";
import DimmoExpressionManager from "@/components/admin/DimmoExpressionManager";

export default function DimmoExpressionsAdminPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ee] px-5 py-10 text-[#2f3732] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-[#637a70] hover:underline">返回后台</Link>
        <header className="mt-5 max-w-3xl">
          <p className="text-sm font-medium text-[#8b6a16]">DIMMO CHARACTER SYSTEM</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dimmo 表情库</h1>
          <p className="mt-3 text-sm leading-7 text-[#68716b]">统一管理成年 Dimmo 与煤球小黑猫。当前仅在后台维护，不会出现在前台；以后接入聊天、任务或小程序时再按场景调用。</p>
        </header>
        <DimmoExpressionManager />
      </div>
    </main>
  );
}
