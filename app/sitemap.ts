import type { MetadataRoute } from "next";
import { listContentUnits } from "@/lib/content-units";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/$/, "");
  const units = await listContentUnits();
  const staticPages = ["", "/workbench", "/library", "/dimmo", "/membership", "/about"].map((path) => ({
    url: `${siteUrl}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/library" ? "daily" as const : "monthly" as const,
    priority: path === "" ? 1 : path === "/library" ? 0.9 : 0.6
  }));

  return [
    ...staticPages,
    ...units.map((unit) => ({
      url: `${siteUrl}/materials/${unit.slug}`,
      lastModified: new Date(unit.meta.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.75
    }))
  ];
}
