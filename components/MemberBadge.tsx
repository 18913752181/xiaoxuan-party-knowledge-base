export function MemberBadge({ isMemberOnly }: { isMemberOnly: boolean }) {
  return (
    <span
      className={`rounded px-3 py-1 text-xs font-medium ${
        isMemberOnly ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {isMemberOnly ? "会员内容" : "免费"}
    </span>
  );
}
