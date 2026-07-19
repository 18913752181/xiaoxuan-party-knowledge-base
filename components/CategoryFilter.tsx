import Link from "next/link";
import { categories } from "@/data/content";

type CategoryFilterProps = {
  active?: string;
  basePath?: string;
  keyword?: string;
};

export function CategoryFilter({ active = "全部", basePath = "/library", keyword }: CategoryFilterProps) {
  const items = ["全部", ...categories];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((category) => {
        const params = new URLSearchParams();
        if (category !== "全部") params.set("category", category);
        if (keyword) params.set("q", keyword);
        const href = params.toString() ? `${basePath}?${params.toString()}` : basePath;
        const isActive = active === category || (!active && category === "全部");

        return (
          <Link
            key={category}
            href={href}
            className={`rounded border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-brand-red bg-brand-red text-white"
                : "border-brand-line bg-white text-neutral-700 hover:border-brand-red hover:text-brand-red"
            }`}
          >
            {category}
          </Link>
        );
      })}
    </div>
  );
}
