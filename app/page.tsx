import type { Metadata } from "next";
import { ResourceLibrary } from "@/components/ResourceLibrary";
import { contentUnitToMaterialSummary, listContentUnits } from "@/lib/content-units";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" }
};

export default async function HomePage() {
  const materials = (await listContentUnits()).map(contentUnitToMaterialSummary);

  return <ResourceLibrary initialMaterials={materials} />;
}
