import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-20 text-center">
      <h1 className="text-3xl font-bold text-brand-ink">没有找到对应内容</h1>
      <p className="mt-4 text-neutral-600">该文章可能不存在，或后续版本再补充。</p>
      <Link
        href="/library"
        className="mt-7 inline-flex rounded bg-brand-red px-6 py-3 text-sm font-semibold text-white hover:bg-brand-darkRed"
      >
        返回资料库
      </Link>
    </section>
  );
}
