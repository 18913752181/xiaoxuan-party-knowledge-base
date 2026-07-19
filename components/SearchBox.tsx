type SearchBoxProps = {
  action?: string;
  defaultValue?: string;
  placeholder?: string;
  category?: string;
};

export function SearchBox({
  action = "/library",
  defaultValue = "",
  placeholder = "输入关键词搜索文章、模板或流程清单",
  category
}: SearchBoxProps) {
  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded border border-brand-line bg-white p-2 shadow-soft sm:flex-row">
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-h-12 flex-1 rounded px-4 text-base outline-none placeholder:text-neutral-400"
      />
      <button
        type="submit"
        className="min-h-12 rounded bg-brand-red px-7 text-sm font-semibold text-white transition hover:bg-brand-darkRed"
      >
        搜索
      </button>
    </form>
  );
}
