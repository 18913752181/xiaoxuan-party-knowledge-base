import { notFound } from "next/navigation";
import { MaterialDetailClient } from "@/components/MaterialDetailClient";
import {
  contentUnitToMaterial,
  contentUnitToMaterialSummary,
  getContentUnitBySlug,
  listContentUnits,
} from "@/lib/content-units";

export const revalidate = 300;

export default async function MaterialDetailPage({ params }: { params: { id: string } }) {
  const slug = params.id.replace(/^content-/, "");
  const [unit, units] = await Promise.all([
    getContentUnitBySlug(slug),
    listContentUnits(),
  ]);

  if (!unit) notFound();

  return (
    <MaterialDetailClient
      initialMaterial={contentUnitToMaterial(unit)}
      initialMaterials={units.map(contentUnitToMaterialSummary)}
    />
  );
}
