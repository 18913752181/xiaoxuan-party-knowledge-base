"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { downloadMaterialFile } from "@/lib/download-file";
import { getArticleSlug, listMyFavorites, toggleFavorite } from "@/lib/favorites";
import { formatDisplayDay } from "@/lib/format-date";
import type { Material } from "@/lib/types";
import SupportCard, { shouldShowSupportCard } from "@/components/SupportCard";

function blocks(text?: string) {
  if (!text) return null;
  return text.split(/\n{2,}/).map((item) => <p key={item} className="whitespace-pre-wrap text-sm leading-6 text-neutral-600">{item.trim()}</p>);
}

function hasKnowledgeContent(text?: string) {
  const value = (text || "").trim();
  return Boolean(value && value !== "待补充" && value !== "暂无" && value !== "无");
}

const officialPolicyLinks = [
  {
    title: "中国共产党章程",
    href: "https://download.12371.cn/wenjian/2022/11/1/djcbesddz.pdf",
  },
  {
    title: "中国共产党基层组织选举工作条例",
    href: "https://www.idcpc.gov.cn/zgzc/zcwj/202008/t20200819_139529.html",
  },
  {
    title: "中国共产党支部工作条例（试行）",
    href: "https://www.idcpc.gov.cn/zgzc/zcwj/201912/t20191216_106820.html",
  },
  {
    title: "中国共产党党员教育管理工作条例",
    href: "https://www.12371.cn/special/dyjygztl/",
  },
  {
    title: "全国党员教育培训工作规划（2024-2028年）",
    href: "https://www.12371.cn/special/dyjygh20242028/",
  },
];

function policyLinks(text: string) {
  const items = text
    .split(/[；;\n]+/)
    .map((item) => item.trim().replace(/[。；;]+$/, ""))
    .filter(Boolean);

  return (
    <ul className="grid gap-3 text-sm leading-6">
      {items.map((item) => {
        const markdownLink = item.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        const customLink = item.match(/^(.*?)\s*[|｜]\s*(https?:\/\/\S+)$/);
        const label = markdownLink?.[1]?.trim() || customLink?.[1]?.trim() || item;
        const customHref = markdownLink?.[2] || customLink?.[2];
        const normalizedLabel = label.replace(/[()（）－—-]/g, "");
        const official = officialPolicyLinks.find((policy) => {
          const normalizedTitle = policy.title.replace(/[()（）－—-]/g, "");
          return normalizedLabel.includes(normalizedTitle) || normalizedTitle.includes(normalizedLabel);
        });
        const href = customHref || official?.href;
        return (
          <li key={item}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-brand-red underline decoration-[#d8bfc2] underline-offset-4 transition-colors duration-150 hover:text-brand-darkRed"
              >
                {label}
              </a>
            ) : (
              <span className="text-neutral-600">{label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function cleanNetworkItems(items?: string[]) {
  return (items || []).map((item) => item.trim()).filter((item) => item && !["无", "暂无", "待补充"].includes(item));
}

export function MaterialDetailClient({ initialMaterial, initialMaterials }: { initialMaterial: Material; initialMaterials: Material[] }) {
  const router = useRouter();
  const [material, setMaterial] = useState<Material | null>(initialMaterial);
  const [allMaterials] = useState<Material[]>(initialMaterials);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [memberOnlyPrompt, setMemberOnlyPrompt] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    listMyFavorites().then(({ rows, error }) => {
      if (!error) setFavoriteSlugs(rows.map((row) => row.article_slug));
    });
  }, []);

  async function onToggleFavorite() {
    if (!material) return;
    const result = await toggleFavorite(material, favoriteSlugs);
    if (!result.ok) return setMessage(result.error);
    const articleSlug = getArticleSlug(material);
    setFavoriteSlugs((current) => result.favorited ? [...current, articleSlug] : current.filter((slug) => slug !== articleSlug));
    if (typeof result.favoriteCount === "number") setMaterial((current) => current ? { ...current, favorite_count: result.favoriteCount! } : current);
    setMessage(result.favorited ? "已收藏。" : "已取消收藏。");
  }

  async function download() {
    if (!material) return;
    setMessage("正在准备下载...");
    const result = await downloadMaterialFile(material);
    if (!result.ok) {
      if (result.membershipRequired) {
        setMemberOnlyPrompt(true);
        setMessage("");
        return;
      }
      setMessage(result.error || "下载失败。");
      if (result.needsLogin) {
        const here = `${window.location.pathname}${window.location.search}`;
        window.setTimeout(() => router.push(`/login?redirect=${encodeURIComponent(here)}`), 800);
      }
      return;
    }

    setMaterial((current) => current ? { ...current, download_count: current.download_count + 1 } : current);
    setMessage("文件下载已开始。");
    if (shouldShowSupportCard()) setShowSupport(true);
  }

  if (!material) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-2xl font-semibold text-brand-ink">没有找到这份资料</h1>
        <p className="mt-3 text-sm text-neutral-500">它可能已被移除或链接有误。</p>
        <Link href="/library" className="mt-6 inline-flex rounded-xl bg-brand-red px-6 py-3 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-darkRed active:scale-[0.98]">返回资料库</Link>
      </section>
    );
  }

  const articleSlug = getArticleSlug(material);
  const isFavorite = favoriteSlugs.includes(articleSlug);
  const policyContent = material.policyBasis || material.legal_basis;
  const noticeContent = material.notices || material.downloadNote;
  const findLinkedMaterial = (reference: string) => {
    const normalized = reference.trim();
    if (!normalized) return null;
    return allMaterials.find((item) => item.slug === normalized || item.id === normalized)
      || allMaterials.find((item) => item.title === normalized)
      || allMaterials.find((item) => item.title.includes(normalized) || normalized.includes(item.title))
      || null;
  };
  const previousItems = cleanNetworkItems(material.relatedMap?.previous);
  const nextItems = cleanNetworkItems(material.relatedMap?.next);
  const previousLinks = previousItems.map(findLinkedMaterial).filter((item): item is Material => Boolean(item));
  const nextLinks = nextItems.map(findLinkedMaterial).filter((item): item is Material => Boolean(item));
  const hasKnowledgeNetwork = previousLinks.length > 0 || nextLinks.length > 0;

  return (
    <section className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
      <Link href="/library" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors duration-150 hover:text-brand-red">
        <span aria-hidden="true">←</span> 返回资料库
      </Link>

      <article className="mt-5 overflow-hidden rounded-2xl border border-brand-line bg-white shadow-soft">
        <div className="bg-[#f8f7f4] p-6 md:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl border border-[#dbc6c9] bg-[#f4e9ea] px-3 py-1.5 text-sm font-semibold text-brand-red">{material.file_type}</span>
            {material.member_only ? <span className="rounded-xl bg-[#f4ede1] px-3 py-1.5 text-sm font-medium text-[#8a6b50]">会员专属</span> : null}
            <span className="rounded-xl border border-brand-line bg-white px-3 py-1.5 text-sm text-neutral-600">{material.topic || material.category}</span>
            {material.stage && material.stage !== (material.topic || material.category) ? <span className="rounded-xl border border-brand-line bg-white px-3 py-1.5 text-sm text-neutral-600">{material.stage}</span> : null}
          </div>

          <h1 className="material-title mt-6 max-w-4xl text-3xl font-semibold leading-[1.18] tracking-tight text-brand-ink md:text-4xl" title={material.title}>{displayMaterialTitle(material.title)}</h1>
          {hasKnowledgeContent(material.description) ? (
            <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-600">{material.description}</p>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={download} className="rounded-xl bg-brand-red px-7 py-3 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-darkRed active:scale-[0.98]">
              下载文件
            </button>
            <button type="button" onClick={onToggleFavorite} className={`rounded-xl border px-6 py-3 text-sm transition-transform duration-150 active:scale-[0.98] ${isFavorite ? "border-[#c79b52] bg-[#fff8e8] text-[#8a6b50]" : "border-brand-line bg-white text-neutral-600"}`}>
              {isFavorite ? "已收藏" : "收藏资料"}
            </button>
          </div>

          {message ? <p className="mt-5 rounded-2xl bg-[#fffaf1] px-4 py-3 text-sm text-[#7a633f]">{message}</p> : null}
          {showSupport && material ? <SupportCard material={material} onClose={() => setShowSupport(false)} /> : null}
          {memberOnlyPrompt ? (
            <div className="mt-5 rounded-2xl border-2 border-[#9a4650] bg-[#fff7f5] p-5">
              <p className="font-semibold text-[#9a4650]">该资料为会员专属</p>
              <p className="mt-2 text-sm text-neutral-600">开通会员后即可下载，会员有效期为一年。</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => setMemberOnlyPrompt(false)} className="rounded-xl border border-[#d8c7c1] bg-white px-5 py-2.5 text-sm text-neutral-600">暂不开通</button>
                <Link href="/membership/payment" className="rounded-xl bg-[#9a4650] px-5 py-2.5 text-sm font-medium text-white">成为专属会员</Link>
              </div>
            </div>
          ) : null}

          <div className="mt-7 grid gap-x-6 gap-y-4 rounded-2xl border border-brand-line bg-white p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-neutral-400">文件名</p>
              <p className="mt-1 break-all font-medium text-neutral-700">{material.file_name || "暂无文件名"}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">更新时间</p>
              <p className="mt-1 font-medium text-neutral-700">{formatDisplayDay(material.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">所属专题</p>
              <p className="mt-1 font-medium text-neutral-700">{material.topic || material.category}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">下载数</p>
              <p className="mt-1 font-medium text-neutral-700">{material.download_count}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">收藏数</p>
              <p className="mt-1 font-medium text-neutral-700">{material.favorite_count}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 p-6 md:p-8">
          {hasKnowledgeContent(material.note) ? <DetailSection title="小宣提醒">{blocks(material.note)}</DetailSection> : null}
          {hasKnowledgeContent(policyContent) ? <DetailSection title="制度依据">{policyLinks(policyContent!)}</DetailSection> : null}
          {hasKnowledgeContent(noticeContent) ? <DetailSection title="填写说明与注意事项">{blocks(noticeContent)}</DetailSection> : null}
          {hasKnowledgeContent(material.faq) ? <DetailSection title="常见问题">{blocks(material.faq)}</DetailSection> : null}

          {hasKnowledgeNetwork ? <section id="knowledge-network" className="border-t border-brand-line py-6 first:border-t-0 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-brand-red">关联知识</p>
            <h2 className="mt-2 text-2xl font-semibold text-brand-ink">知识网络</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {previousLinks.length ? <NetworkList title="上一步工作" items={previousLinks} /> : null}
              {nextLinks.length ? <NetworkList title="下一步工作" items={nextLinks} /> : null}
            </div>
          </section> : null}
        </div>
      </article>
    </section>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-brand-line py-6 first:border-t-0 first:pt-0 last:pb-0">
      <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

function NetworkList({ title, items }: { title: string; items: Material[] }) {
  return (
    <div className="rounded-xl border border-brand-line bg-white p-4">
      <h3 className="font-semibold text-brand-ink">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
        {items.map((item) => (
          <li key={item.slug || item.id}>
            <Link href={`/materials/${item.slug || item.id}`} className="text-brand-red transition-colors duration-150 hover:text-brand-darkRed">{displayMaterialTitle(item.title)}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function displayMaterialTitle(title: string) {
  return title.replace(/^【小宣资料库】\s*/, "").trim();
}
