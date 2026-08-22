"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultWorkLevels, type WorkLevel } from "@/lib/work-panorama";

const levelStyles = [
  {
    role: "决策统筹",
    badge: "bg-[#fff1f2] text-brand-red",
  },
  {
    role: "协同指导",
    badge: "bg-[#fff1f2] text-brand-red",
  },
  {
    role: "基层落实",
    badge: "bg-[#fff1f2] text-brand-red",
  },
];

export function WorkPanoramaHome() {
  const [workLevels, setWorkLevels] = useState<WorkLevel[]>(defaultWorkLevels);

  useEffect(() => {
    fetch("/api/work-panorama", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setWorkLevels(data.levels || defaultWorkLevels))
      .catch(() => undefined);
  }, []);
  return (
    <section className="border-t border-brand-line pt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-brand-ink">工作全景</h2>
          <p className="mt-1.5 text-sm text-neutral-500">按组织层级，快速进入对应工作</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {workLevels.map((level, index) => {
          const style = levelStyles[index % levelStyles.length];
          return (
            <Link
              key={level.slug}
              href={`/work-panorama/${level.slug}`}
              className="group relative min-h-32 overflow-hidden rounded-2xl border border-brand-line bg-white px-5 py-5 transition-[border-color,background-color,box-shadow,transform] duration-150 hover:border-[#d9a6ac] hover:bg-[#fafbfc] hover:shadow-[0_10px_24px_rgba(35,43,52,0.04)] active:scale-[0.99]"
            >
              <div className="flex h-full flex-col justify-between">
                <span className={`w-fit rounded-lg px-2.5 py-1 text-[11px] font-medium ${style.badge}`}>
                  {style.role}
                </span>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-brand-ink">{level.name}</h3>
                    <p className="mt-1 text-xs text-neutral-500">{level.shortDescription}</p>
                  </div>
                  <span className="pb-0.5 text-lg text-neutral-400 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-brand-red" aria-hidden="true">→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
