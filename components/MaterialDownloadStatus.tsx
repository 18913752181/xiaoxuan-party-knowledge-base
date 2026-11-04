import Link from "next/link";
import type { MaterialPointState } from "@/lib/material-point-view";

export function MaterialDownloadStatus({ state }: { state: MaterialPointState | null }) {
  if (!state) return null;
  if (state.policy !== "annual_daily") return <p className="mt-4 text-sm leading-7 text-neutral-600">{state.legacyBenefits ? "保留原会员权益：有效期内下载免扣积分，不受新会员每日10份限制。" : "保留原积分制会员权益：首次解锁扣积分，再次下载免费，不受新会员每日10份限制。"}</p>;
  return <div className="mt-4 rounded-xl border border-brand-line bg-[#fffaf1] p-4 text-sm leading-7 text-neutral-600">
    {state.canDownload ? <>
      <p className="font-medium text-brand-ink">今日已下载 {state.dailyUsed ?? 0}/10 份，还可下载 {state.dailyRemaining ?? 0} 个不同文件</p>
      <p>可用积分 {state.pointsBalance}：长期积分 {state.permanentPoints ?? 0} ＋ 今日赠送剩余 {state.dailyPoints ?? 0}。</p>
      <p>每日赠送5积分，当天有效、优先消耗；名额按北京时间零点重置。已解锁资料再次下载免费，跨天下载仍占当天名额。</p>
      <p>年卡下载权益有效期至 {state.annualExpiresAt}</p>
    </> : <p>新会员仅年卡可下载资料，月卡和季卡不含资料库下载权限。</p>}
    <Link href="/membership/payment" className="inline-block font-medium text-brand-red underline underline-offset-4">查看会员权益</Link>
  </div>;
}

export function DownloadQuotaNotice({ message }: { message: string }) {
  return <div role="alert" className="mt-4 rounded-xl border border-brand-line bg-[#fffaf1] p-4 text-sm leading-7 text-neutral-600"><p>{message}</p><Link href="/me" className="font-medium text-brand-red underline underline-offset-4">前往会员中心</Link></div>;
}
