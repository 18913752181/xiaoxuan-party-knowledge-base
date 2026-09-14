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
  return <section className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
    <Link href={`/materials/${encodeURIComponent(unit.slug)}`} className="text-sm font-medium text-neutral-600 hover:text-brand-red">← 返回资料详情</Link>
    <article className="mt-5 rounded-2xl border border-brand-line bg-white p-6 shadow-soft md:p-8">
      <h1 className="material-title mb-6 text-2xl font-semibold leading-snug text-brand-ink md:text-3xl">{title}</h1>
      <MaterialPreview key={unit.slug} slug={unit.slug} title={title} standalone />
    </article>
  </section>;
}
