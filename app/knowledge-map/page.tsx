import Link from "next/link";
import { contentUnitToMaterial, listContentUnits } from "@/lib/content-units";
import type { Material } from "@/lib/types";

export const dynamic = "force-dynamic";

const topicStages: Record<string, Record<string, string[]>> = {
  发展党员: {
    申请入党: ["入党申请书", "同入党申请人谈话记录"],
    积极分子: ["推荐和确定入党积极分子", "培养联系人", "思想汇报", "培养考察意见"],
    发展对象: ["确定发展对象", "政治审查", "短期集中培训", "公示"],
    接收预备党员: ["入党志愿书", "支部大会", "党委审批"],
    预备党员转正: ["转正申请", "预备党员考察记录", "转正大会", "转正审批"]
  },
  民主生活会: {
    会前准备: ["方案制定", "征求意见", "谈心谈话"],
    会议召开: ["对照检查材料", "批评与自我批评"],
    会后整改: ["整改清单", "整改通报"]
  },
  三会一课: {
    支部党员大会: ["会议议题", "会议记录"],
    支委会: ["议事规则", "会议纪要"],
    党小组会: ["学习讨论", "问题收集"],
    党课: ["党课讲稿", "课件提纲"]
  },
  第一议题: {
    学习安排: ["学习计划", "议题设置"],
    贯彻落实: ["落实清单", "跟踪问效"]
  },
  中心组学习: {
    学习计划: ["年度计划", "专题安排"],
    学习材料: ["研讨发言", "学习记录"]
  },
  换届选举: {
    前期筹备: ["请示报告", "候选人酝酿"],
    会议选举: ["选举办法", "大会主持词"],
    后续报批: ["选举结果报告", "材料归档"]
  },
  主题党日: {
    方案策划: ["活动方案", "学习主题"],
    组织实施: ["签到记录", "活动记录"]
  },
  党课课件: {
    选题: ["主题确定", "案例收集"],
    讲稿: ["党课讲稿", "PPT提纲"]
  }
};

function materialTopic(material: Material) {
  return material.topic || material.category || "未分专题";
}

function buildHotTopics(materials: Material[]) {
  const groups = new Map<string, { topic: string; count: number; downloads: number; latestAt: number }>();

  materials.forEach((material) => {
    const topic = materialTopic(material);
    const current = groups.get(topic) || { topic, count: 0, downloads: 0, latestAt: 0 };
    current.count += 1;
    current.downloads += material.download_count || 0;
    current.latestAt = Math.max(current.latestAt, new Date(material.updated_at).getTime() || 0);
    groups.set(topic, current);
  });

  return Array.from(groups.values())
    .sort((a, b) => b.downloads - a.downloads || b.latestAt - a.latestAt || b.count - a.count)
    .slice(0, 6);
}

export default async function KnowledgeMapPage() {
  const materials = (await listContentUnits()).map(contentUnitToMaterial);
  const hotTopics = buildHotTopics(materials);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
      <section className="mb-10">
        <p className="mb-4 text-sm font-medium tracking-wide text-brand-sageDark">小宣同志基层党建知识体系</p>
        <h1 className="text-4xl font-semibold text-brand-ink">知识地图</h1>
        <p className="mt-5 max-w-3xl leading-8 text-neutral-600">
          文件仍然是入口，但每份资料也可以成为知识节点。你可以按专题、阶段和关联路径继续阅读，也可以回到详情页下载模板、收藏资料。
        </p>
      </section>

      {hotTopics.length ? (
        <section className="mb-8 rounded-[1.75rem] border border-[#ebe5dc] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#6f8b7b]">实时热门专题</p>
              <h2 className="mt-2 text-2xl font-semibold text-brand-ink">根据最新更新和下载情况推荐</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {hotTopics.map((item) => (
              <Link key={item.topic} href={`/topics/${encodeURIComponent(item.topic)}`} className="rounded-2xl bg-[#fbfaf6] p-5 transition hover:bg-[#f4f0e8]">
                <p className="font-semibold text-brand-ink">{item.topic}</p>
                <p className="mt-2 text-sm text-neutral-500">{item.count} 份资料 · 下载数 {item.downloads}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6">
        {Object.entries(topicStages).map(([topic, stages]) => {
          const topicMaterials = materials.filter((item) => materialTopic(item) === topic);
          return (
            <section key={topic} className="rounded-[1.75rem] border border-[#ebe5dc] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-brand-ink">{topic}</h2>
                  <p className="mt-2 text-sm text-neutral-500">已沉淀 {topicMaterials.length} 个本地资料节点</p>
                </div>
                <Link href={`/topics/${encodeURIComponent(topic)}`} className="text-sm text-brand-sageDark">
                  查看专题资料
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {Object.entries(stages).map(([stage, nodes]) => (
                  <div key={stage} className="rounded-2xl bg-[#fbfaf6] p-5">
                    <h3 className="font-semibold text-brand-ink">{stage}</h3>
                    <div className="mt-4 grid gap-3">
                      {nodes.map((node) => {
                        const material = topicMaterials.find((item) => item.title.includes(node) || item.network?.nodeTitle?.includes(node));
                        const materialHref = material ? `/materials/${material.slug || material.id}` : "";
                        return (
                          <div key={node} className="rounded-2xl bg-white p-4">
                            <p className="font-medium text-brand-ink">{node}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {material ? (
                                <>
                                  <Link href={materialHref} className="rounded-full border border-[#ebe5dc] px-3 py-1 text-xs text-neutral-600">
                                    查看知识点
                                  </Link>
                                  <Link href={`${materialHref}#knowledge-network`} className="rounded-full border border-[#ebe5dc] px-3 py-1 text-xs text-neutral-600">
                                    关联阅读
                                  </Link>
                                  <Link href={materialHref} className="rounded-full border border-[#ebe5dc] px-3 py-1 text-xs text-neutral-600">
                                    收藏
                                  </Link>
                                  <Link href={materialHref} className="rounded-full bg-[#6f8b7b] px-3 py-1 text-xs text-white">
                                    进入详情下载
                                  </Link>
                                </>
                              ) : (
                                <span className="text-xs text-neutral-500">节点待补充资料</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
