import { Suspense } from "react";
import { ResourceLibrary } from "@/components/ResourceLibrary";

export default function LibraryPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-6xl px-5 py-12 text-neutral-600">正在读取资料库...</section>}>
      <ResourceLibrary />
    </Suspense>
  );
}
