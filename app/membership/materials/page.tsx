
import { notFound } from "next/navigation";
import { contentUnitToMaterialSummary, getContentUnitBySlug } from "@/lib/content-units";
import MaterialPurchaseCheckout from "@/components/MaterialPurchaseCheckout";

export const dynamic = "force-dynamic";

export default async function MaterialPurchasePage({ searchParams }: { searchParams: { slug?: string } }) {
  const slug = searchParams.slug;
  if (typeof slug !== "string" || !slug || slug.length > 255) notFound();
  const unit = await getContentUnitBySlug(slug);
  if (!unit || unit.meta.status !== "published") notFound();
  const material = contentUnitToMaterialSummary(unit);
  if (!material.file_url) notFound();
  return <MaterialPurchaseCheckout material={material} />;
}
