import type { Metadata } from "next";
import { getContentUnitBySlug } from "@/lib/content-units";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const slug = params.id.replace(/^content-/, "");
  const unit = await getContentUnitBySlug(slug);

  if (!unit) {
    return { title: "资料未找到", robots: { index: false, follow: false } };
  }

  const title = unit.seo.seoTitle || unit.meta.title;
  const description = (unit.seo.seoDescription || unit.meta.summary || unit.summary || unit.introduction || "查看工作资料与填写说明。")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const canonical = `/materials/${unit.slug}`;

  return {
    title,
    description,
    keywords: unit.seo.seoKeywords,
    alternates: { canonical },
    openGraph: {
      title: `${title} | 小宣资料库`,
      description,
      type: "article",
      url: canonical,
      modifiedTime: unit.meta.updatedAt,
      publishedTime: unit.meta.createdAt
    }
  };
}

export default function MaterialLayout({ children }: { children: React.ReactNode }) {
  return children;
}
