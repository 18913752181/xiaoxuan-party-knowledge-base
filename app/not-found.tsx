import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-24 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-[#9a4650]">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-brand-ink">没有找到对应内容</h1>
      <p className="mt-4 text-neutral-600">该页面可能不存在、已被移除，或后续版本再补充。</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/library"
          className="rounded-xl bg-brand-red px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-darkRed"
        >
          返回资料库
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-[#e4ded5] bg-white px-6 py-3 text-sm font-medium text-neutral-600 transition hover:border-[#c9a2a6] hover:text-[#8d2f32]"
        >
          回到首页
        </Link>
      </div>
    </section>
  );
}
