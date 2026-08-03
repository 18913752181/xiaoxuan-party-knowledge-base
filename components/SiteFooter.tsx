import Link from "next/link";

export function SiteFooter() {
  // pb-24 为移动端底部固定导航预留空间，桌面端恢复正常间距。
  return (
    <footer className="border-t border-[#ebe5dc] bg-white/45 pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9a4650] text-sm font-semibold text-white">宣</span>
            <span className="text-base font-semibold text-brand-ink">宣知 · 小宣资料库</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-neutral-500">
            整理常用党建资料、制度文件和工作模板，配上填写说明，支持分类查找、收藏与下载。
          </p>
        </div>
        <nav aria-label="页脚导航">
          <p className="text-sm font-semibold text-brand-ink">快速入口</p>
          <ul className="mt-3 grid gap-2 text-sm text-neutral-500">
            <li><Link href="/library" className="transition hover:text-[#9a4650]">资料库</Link></li>
            <li><Link href="/#submit-question" className="transition hover:text-[#9a4650]">提交问题</Link></li>
            <li><Link href="/membership" className="transition hover:text-[#9a4650]">会员服务</Link></li>
            <li><Link href="/about" className="transition hover:text-[#9a4650]">关于我们</Link></li>
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold text-brand-ink">备案信息</p>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 block w-fit text-sm text-neutral-500 transition hover:text-[#9a4650]"
          >
            苏ICP备2026052948号
          </a>
          <p className="mt-2 text-sm text-neutral-500">© 2026 【宣知网】 · 小宣同志资料库</p>
        </div>
      </div>
    </footer>
  );
}
