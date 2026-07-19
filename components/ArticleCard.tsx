import Link from "next/link";
import { Article } from "@/data/content";
import { MemberBadge } from "@/components/MemberBadge";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="rounded border border-brand-line bg-white p-6 transition hover:border-brand-red hover:shadow-soft">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-brand-gray px-3 py-1 text-xs font-medium text-neutral-700">
          {article.category}
        </span>
        <MemberBadge isMemberOnly={article.isMemberOnly} />
      </div>
      <h2 className="mb-3 text-xl font-bold text-brand-ink">
        <Link href={`/articles/${article.id}`} className="hover:text-brand-red">
          {article.title}
        </Link>
      </h2>
      <p className="mb-5 leading-7 text-neutral-600">{article.summary}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500">
        <span>更新时间：{article.updatedAt}</span>
        <Link href={`/articles/${article.id}`} className="font-semibold text-brand-red hover:text-brand-darkRed">
          查看详情
        </Link>
      </div>
    </article>
  );
}
