import Link from "next/link";
export type PointsShortfall = { requiredPoints: number; pointsBalance: number };
export function InsufficientPointsNotice({ requiredPoints, pointsBalance }: PointsShortfall) {
  return <div role="alert" className="mt-4 rounded-xl border border-[#e8d4a5] bg-[#fff8e8] p-4 text-sm leading-7 text-[#7a633f]">
    <p className="font-semibold">积分不足</p>
    <p>本次需要 {requiredPoints} 积分，现有 {pointsBalance} 积分，还差 {Math.max(0, requiredPoints - pointsBalance)} 积分。</p>
    <Link href="/me" className="mt-2 inline-flex rounded-lg bg-brand-red px-4 py-2 font-medium text-white">前往会员中心</Link>
  </div>;
}
