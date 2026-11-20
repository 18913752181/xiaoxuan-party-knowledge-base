
import { notFound } from "next/navigation";
import { contentUnitToMaterialSummary, getContentUnitBySlug, getContentUnitDownloadFilePath } from "@/lib/content-units";
import MaterialPurchaseCheckout from "@/components/MaterialPurchaseCheckout";
import { supportsMaterialPreview } from "@/lib/material-preview";

export const dynamic = "force-dynamic";

export default async function MaterialPurchasePage({ searchParams }: { searchParams: { slug?: string } }) {
  const slug = searchParams.slug;
  if (typeof slug !== "string" || !slug || slug.length > 255) notFound();
  const unit = await getContentUnitBySlug(slug);
  if (!unit || unit.meta.status !== "published") notFound();
  const material = contentUnitToMaterialSummary(unit);
  if (!material.file_url) notFound();
  const file = await getContentUnitDownloadFilePath(slug);
  return <MaterialPurchaseCheckout material={material} hasPreview={Boolean(file && supportsMaterialPreview(file.path))} />;
}
