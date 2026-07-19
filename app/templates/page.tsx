import { CategoryFilter } from "@/components/CategoryFilter";
import { SearchBox } from "@/components/SearchBox";
import { SectionHeading } from "@/components/SectionHeading";
import { TemplateCard } from "@/components/TemplateCard";
import { filterTemplates } from "@/lib/content";

type TemplatesPageProps = {
  searchParams: {
    q?: string;
    category?: string;
  };
};

export default function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const resources = filterTemplates({
    keyword: searchParams.q,
    category: searchParams.category
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <SectionHeading
        eyebrow="模板下载区"
        title="可编辑资料与流程表单"
        description="展示 Word、Excel、PDF 类型资料。MVP 阶段按钮为静态交互，会员资料会提示开通会员。"
      />
      <div className="mb-7">
        <SearchBox action="/templates" defaultValue={searchParams.q} category={searchParams.category} />
      </div>
      <div className="mb-8">
        <CategoryFilter active={searchParams.category || "全部"} basePath="/templates" keyword={searchParams.q} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {resources.length > 0 ? (
          resources.map((template) => <TemplateCard key={template.id} template={template} />)
        ) : (
          <div className="rounded border border-brand-line bg-white p-10 text-center text-neutral-600 md:col-span-2">
            暂无匹配模板，请尝试其他关键词或分类。
          </div>
        )}
      </div>
    </section>
  );
}
