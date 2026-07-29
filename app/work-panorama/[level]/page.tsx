import Link from "next/link";
import { notFound } from "next/navigation";
import { contentUnitToMaterial, listContentUnits } from "@/lib/content-units";
import { getWorkLevel, getWorkLevels } from "@/lib/work-panorama-store";
import { getTopicPanoramaMap, topicsForPlacement } from "@/lib/topic-panorama";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return (await getWorkLevels()).map((level) => ({ level: level.slug }));
}

export default async function WorkPanoramaPage({
  params,
  searchParams,
}: {
  params: { level: string };
  searchParams: { section?: string; topic?: string };
}) {
  const level = await getWorkLevel(params.level);
  if (!level) notFound();

  const materials = (await listContentUnits()).map(contentUnitToMaterial);
  const selectedSection = level.sections.find((section) => section.name === searchParams.section);
  const topicMap = await getTopicPanoramaMap();
  const sectionTopics = selectedSection
    ? topicsForPlacement(topicMap, level.slug, selectedSection.name)
        .map((topic) => ({
          name: topic,
          count: materials.filter((material) => (material.topic || material.category) === topic).length,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"))
    : [];
  const selectedTopic = sectionTopics.find((topic) => topic.name === searchParams.topic);
  const filtered = selectedTopic
    ? materials.filter((material) => (material.topic || material.category) === selectedTopic.name)
    : [];

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-5 py-10 text-brand-ink lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-[#8f555b]">← 返回首页</Link>
        <section className="mt-5 rounded-3xl border border-[#e3d9cf] bg-white px-6 py-8 md:px-9">
          <p className="text-sm font-medium text-[#9a4650]">工作全景</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{level.name}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-500">{level.description}</p>
        </section>

        {!selectedSection ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {level.sections.map((section) => (
              <Link
                key={section.name}
                href={`/work-panorama/${level.slug}?section=${encodeURIComponent(section.name)}#topics`}
                className="group flex min-h-24 items-center rounded-2xl border border-[#e5ddd4] bg-white px-6 py-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#d6c8bc] hover:bg-[#fcfaf7] hover:shadow-soft"
              >
                <h2 className="text-lg font-semibold text-brand-ink transition group-hover:text-brand-red">
                  {section.name}
                </h2>
              </Link>
            ))}
          </div>
        ) : null}

        {selectedSection && !selectedTopic ? (
          <section id="topics" className="mt-8 scroll-mt-24">
            <Link href={`/work-panorama/${level.slug}`} className="text-sm text-[#8f555b]">
              ← 返回{level.name}
            </Link>
            <p className="mt-5 text-xs tracking-[0.16em] text-[#9a4650]">工作分类</p>
            <h2 className="mt-2 text-2xl font-semibold text-brand-ink">{selectedSection.name}</h2>
            {sectionTopics.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {sectionTopics.map((topic) => (
                  <Link
                    key={topic.name}
                    href={`/work-panorama/${level.slug}?section=${encodeURIComponent(selectedSection.name)}&topic=${encodeURIComponent(topic.name)}#knowledge-units`}
                    className="group flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-[#e5ddd4] bg-white px-6 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d6c8bc] hover:shadow-soft"
                  >
                    <h3 className="text-lg font-semibold transition group-hover:text-brand-red">{topic.name}</h3>
                    <span className="shrink-0 rounded-full bg-[#f3e9e8] px-3 py-1 text-xs text-[#9a4650]">
                      {topic.count} 个知识单元
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[#ddd2c8] bg-white px-5 py-8 text-center text-sm text-neutral-400">
                持续建设中
              </div>
            )}
          </section>
        ) : null}

        {selectedSection && selectedTopic ? (
          <section id="knowledge-units" className="mt-8 scroll-mt-24">
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-[#8f555b]">
              <Link href={`/work-panorama/${level.slug}`}>{level.name}</Link>
              <span>/</span>
              <Link href={`/work-panorama/${level.slug}?section=${encodeURIComponent(selectedSection.name)}#topics`}>
                {selectedSection.name}
              </Link>
              <span>/</span>
              <span>{selectedTopic.name}</span>
            </div>
            <p className="mt-5 text-xs tracking-[0.16em] text-[#9a4650]">专题</p>
            <h2 className="mt-2 text-2xl font-semibold text-brand-ink">{selectedTopic.name}</h2>
            <p className="mt-2 text-sm text-neutral-500">该专题下的知识单元</p>
            {filtered.length ? (
              <div className="mt-4 divide-y divide-[#eee8e1] overflow-hidden rounded-2xl border border-[#e5ddd4] bg-white">
                {filtered.map((material) => (
                  <Link
                    key={material.id}
                    href={`/materials/${material.slug || material.id}`}
                    className="block px-5 py-4 transition hover:bg-[#fcfaf7]"
                  >
                    <h3 className="text-base font-semibold leading-7">{material.title}</h3>
                    <p className="mt-1 text-xs text-neutral-400">知识单元 · {material.file_type}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[#ddd2c8] bg-white px-5 py-8 text-center text-sm text-neutral-400">
                持续建设中
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
