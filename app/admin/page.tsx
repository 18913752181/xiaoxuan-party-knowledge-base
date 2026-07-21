import Link from "next/link";

const links = [
  {
    href: "/admin/new",
    title: "新增资料",
    description: "上传资料文件，补充知识说明，保存为可下载、可检索、可关联的资料节点。"
  },
  {
    href: "/admin/materials",
    title: "资料列表",
    description: "查看、预览、编辑和删除所有本地 content 资料。"
  },
  {
    href: "/admin/topics",
    title: "专题管理",
    description: "新增专题，或修改现有专题名称，并同步更新资料专题字段。"
  },
  {
    href: "/admin/questions",
    title: "问题管理",
    description: "查看前台收集的问题，填写小宣的回答，并决定是否在前台公开。"
  },
  {
    href: "/",
    title: "返回前台",
    description: "回到小宣同志基层党建工作平台首页。"
  }
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ed] px-6 py-12 text-[#2f3732]">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-[#6f8f7e]">后台管理</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">资料管理中心</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[#66706a]">
          文件是主体，知识说明是辅助。后台只负责录入、编辑、保存和展示，不接 AI，不迁移文章到 Supabase。
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-[#e4ded2] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#90a99a]">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#717b75]">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
