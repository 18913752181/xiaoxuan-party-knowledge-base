import { Article, Category, TemplateResource, articles, templates } from "@/data/content";

export function normalizeKeyword(keyword?: string) {
  return (keyword || "").trim().toLowerCase();
}

export function filterArticles(params: {
  keyword?: string;
  category?: string;
}): Article[] {
  const keyword = normalizeKeyword(params.keyword);

  return articles.filter((article) => {
    const matchesCategory =
      !params.category || params.category === "全部" || article.category === params.category;
    const text = [article.title, article.category, article.summary, ...article.body]
      .join(" ")
      .toLowerCase();
    const matchesKeyword = !keyword || text.includes(keyword);

    return matchesCategory && matchesKeyword;
  });
}

export function filterTemplates(params: {
  keyword?: string;
  category?: string;
}): TemplateResource[] {
  const keyword = normalizeKeyword(params.keyword);

  return templates.filter((template) => {
    const matchesCategory =
      !params.category || params.category === "全部" || template.category === params.category;
    const text = [template.title, template.category, template.fileType].join(" ").toLowerCase();
    const matchesKeyword = !keyword || text.includes(keyword);

    return matchesCategory && matchesKeyword;
  });
}

export function getArticleById(id: string) {
  return articles.find((article) => article.id === id);
}

export function isCategory(value?: string): value is Category {
  return Boolean(
    value &&
      ["发展党员", "换届选举", "三会一课", "组织生活会", "学习教育", "支部建设"].includes(value)
  );
}
