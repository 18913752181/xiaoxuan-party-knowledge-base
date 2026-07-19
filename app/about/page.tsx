import { SectionHeading } from "@/components/SectionHeading";

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
      <SectionHeading
        eyebrow="关于"
        title="小宣同志是谁"
        description="这里不是一个热闹的卖课页面，只是把基层工作里常用、常查、常改的资料慢慢整理好。"
      />
      <div className="rounded-2xl border border-brand-line bg-white p-8 text-lg leading-9 text-neutral-700 shadow-soft">
        <p>
          小宣同志，一个仍在基层党建路上不断学习的党务工作者，持续整理基层党务实务经验。
        </p>
        <p className="mt-5">
          这个资料库希望把常见党务工作的流程、材料、表格和注意事项整理得更清楚、更顺手，帮助基层党务工作者少走弯路，把时间更多用在真正重要的组织工作上。
        </p>
      </div>
    </section>
  );
}
