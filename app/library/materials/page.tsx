import type { Metadata } from "next";
import { ResourceLibrary } from "@/components/ResourceLibrary";
import { contentUnitToMaterialSummary, listContentUnits } from "@/lib/content-units";

// See /library: the public list must read the shared production content at
// request time rather than the seed files bundled during the image build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "全部资料",
  description: "按专题、更新时间和使用场景查找全部工作资料。",
  alternates: { canonical: "/library/materials" }
};

export default async function LibraryMaterialsPage() {
  const materials = (await listContentUnits()).map(contentUnitToMaterialSummary);
  return <ResourceLibrary initialMaterials={materials} libraryOnly />;
}
