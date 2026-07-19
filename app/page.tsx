import { Suspense } from "react";
import { ResourceLibrary } from "@/components/ResourceLibrary";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-6xl px-5 py-12 text-neutral-600">正在读取资料库...</section>}>
      <ResourceLibrary />
    </Suspense>
  );
}
