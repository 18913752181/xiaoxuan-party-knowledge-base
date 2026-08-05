import { SectionHeading } from "@/components/SectionHeading";

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
      <SectionHeading
        eyebrow="关于"
        title="小宣同志"
      />
      <div className="rounded-2xl border border-brand-line bg-white p-8 text-lg leading-9 text-neutral-700 shadow-soft">
        <p>
          基层党务人的“随身资料库”——小宣「红心干货社」来啦！多年机关党建经验分享，手把手带“新手党务”快速上手。跟着小宣学党建，从入门到实操都靠谱！
        </p>
        <p className="mt-5">
          这个资料库希望把常见党务工作的流程、材料、表格和注意事项整理得更清楚、更顺手，帮助基层党务工作者少走弯路，把时间更多用在真正重要的组织工作上。
        </p>
      </div>
    </section>
  );
}
