export function SiteFooter() {
  // pb-24 为移动端底部固定导航预留空间，桌面端恢复正常间距。
  return (
    <footer className="border-t border-[#ebe5dc] bg-white/45 pb-24 lg:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-neutral-500 lg:px-8">
        <p>© 2026 【宣知网】 · 小宣同志资料库</p>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="w-fit transition hover:text-[#9a4650]">苏ICP备2026050150号</a>
      </div>
    </footer>
  );
}
