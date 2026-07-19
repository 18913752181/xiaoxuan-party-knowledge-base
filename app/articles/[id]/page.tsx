import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberBadge } from "@/components/MemberBadge";
import { getArticleById } from "@/lib/content";

type ArticleDetailPageProps = {
  params: {
    id: string;
  };
};

export default function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const article = getArticleById(params.id);

  if (!article) {
    notFound();
  }

  const visibleBody =
    article.isMemberOnly && article.previewParagraphs
      ? article.body.slice(0, article.previewParagraphs)
      : article.body;

  return (
    <article className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
      <Link href="/library" className="mb-8 inline-block text-sm font-semibold text-brand-red hover:text-brand-darkRed">
        返回资料库
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="rounded bg-brand-gray px-3 py-1 text-sm font-medium text-neutral-700">
          {article.category}
        </span>
        <MemberBadge isMemberOnly={article.isMemberOnly} />
        <span className="text-sm text-neutral-500">更新时间：{article.updatedAt}</span>
      </div>
      <h1 className="text-3xl font-bold leading-tight text-brand-ink md:text-5xl">{article.title}</h1>
      <p className="mt-5 border-b border-brand-line pb-8 text-lg leading-8 text-neutral-600">
        {article.summary}
      </p>
      <div className="prose-content mt-8 text-lg text-neutral-800">
        {visibleBody.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {article.isMemberOnly ? (
        <div className="mt-10 rounded border border-brand-red bg-white p-7 shadow-soft">
          <h2 className="text-2xl font-bold text-brand-ink">开通会员查看完整内容/下载模板</h2>
          <p className="mt-3 leading-7 text-neutral-600">
            会员可查看完整专题内容，下载可编辑 Word 模板、Excel 台账、资料包和工作清单。
          </p>
          <Link
            href="/membership"
            className="mt-5 inline-flex rounded bg-brand-red px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-darkRed"
          >
            查看会员方案
          </Link>
        </div>
      ) : null}
    </article>
  );
}
