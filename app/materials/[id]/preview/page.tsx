import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentUnitBySlug } from "@/lib/content-units";
import { MaterialPreview } from "@/components/MaterialPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "资料预览", robots: { index: false, follow: false } };

export default async function MaterialPreviewPage({ params }: { params: { id: string } }) {
  const unit = await getContentUnitBySlug(params.id.replace(/^content-/, ""));
  if (!unit) notFound();
  const title = unit.meta.title.replace(/^【小宣资料库】\s*/, "").trim();
  return <section className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="mb-5 flex items-start gap-4">
      <Link href={`/materials/${encodeURIComponent(unit.slug)}`} aria-label="返回资料详情" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-line bg-white text-xl text-brand-ink transition-colors hover:bg-[#f7f7f7]">←</Link>
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium text-neutral-500">资料扫描预览</p>
        <h1 className="material-title text-xl font-semibold leading-snug text-brand-ink sm:text-2xl">{title}</h1>
      </div>
    </div>
    <article className="overflow-hidden rounded-2xl border border-[#dedede] bg-[#f1f1f1] shadow-[0_18px_50px_rgba(0,0,0,0.07)]">
      <MaterialPreview key={unit.slug} slug={unit.slug} title={title} standalone />
    </article>
  </section>;
}
