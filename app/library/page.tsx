import type { Metadata } from "next";
import { ResourceLibrary } from "@/components/ResourceLibrary";
import { contentUnitToMaterialSummary, listContentUnits } from "@/lib/content-units";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "工作资料库",
  description: "按专题、文件类型和使用场景查找工作模板、制度文件与填写说明。",
  alternates: { canonical: "/library" },
  openGraph: {
    title: "工作资料库 | 小宣资料库",
    description: "按专题查找可直接使用的工作模板、制度文件与填写说明。",
    url: "/library"
  }
};

export default async function LibraryPage() {
  const materials = (await listContentUnits()).map(contentUnitToMaterialSummary);
  return <ResourceLibrary initialMaterials={materials} libraryOnly />;
}
