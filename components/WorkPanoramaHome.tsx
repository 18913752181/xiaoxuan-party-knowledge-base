"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultWorkLevels, type WorkLevel } from "@/lib/work-panorama";

const levelStyles = [
  {
    role: "决策统筹",
    marker: "bg-[#d8a35d]",
    badge: "bg-[#fbf2e4] text-[#a86d25]",
    glow: "from-[#fffaf1] to-[#fffdf9]",
  },
  {
    role: "协同指导",
    marker: "bg-[#77a08f]",
    badge: "bg-[#edf5f1] text-[#527a69]",
    glow: "from-[#f7fbf8] to-[#fffdf9]",
  },
  {
    role: "基层落实",
    marker: "bg-[#b87970]",
    badge: "bg-[#f8eeec] text-[#92544c]",
    glow: "from-[#fcf6f4] to-[#fffdf9]",
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
    <section className="rounded-[28px] bg-[#f3f2ef] px-4 py-5 md:px-6 md:py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-brand-ink">工作全景</h2>
          <p className="mt-1.5 text-sm text-[#8a8985]">按组织层级，快速进入对应工作</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {workLevels.map((level, index) => {
          const style = levelStyles[index % levelStyles.length];
          return (
            <Link
              key={level.slug}
              href={`/work-panorama/${level.slug}`}
              className={`group relative min-h-32 overflow-hidden rounded-[22px] border border-white/80 bg-gradient-to-br ${style.glow} px-5 py-5 shadow-[0_6px_22px_rgba(64,58,51,0.055)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(64,58,51,0.09)]`}
            >
              <span className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${style.marker}`} aria-hidden="true" />
              <div className="flex h-full flex-col justify-between pl-1">
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${style.badge}`}>
                  {style.role}
                </span>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-brand-ink">{level.name}</h3>
                    <p className="mt-1 text-xs text-[#908f8b]">{level.shortDescription}</p>
                  </div>
                  <span className="pb-0.5 text-lg text-[#aaa8a2] transition group-hover:translate-x-1 group-hover:text-[#7b7974]" aria-hidden="true">→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
