const FILE_TYPE_STYLES: Record<string, { badge: string; bg: string }> = {
  word: { badge: "W", bg: "#2f5a9e" },
  excel: { badge: "X", bg: "#2f7d4f" },
  pdf: { badge: "P", bg: "#b03a2e" },
  ppt: { badge: "S", bg: "#c2662d" }
};

export function fileTypeKey(fileType?: string) {
  const value = (fileType || "").toLowerCase();
  if (value.includes("word") || value.includes("doc")) return "word";
  if (value.includes("excel") || value.includes("xls")) return "excel";
  if (value.includes("pdf")) return "pdf";
  if (value.includes("ppt")) return "ppt";
  return "other";
}

/** 文件类型小图标：Word 蓝 / Excel 绿 / PDF 红 / PPT 橙，其他用品牌灰绿。 */
export function FileTypeIcon({ fileType, size = "md" }: { fileType?: string; size?: "sm" | "md" | "lg" }) {
  const style = FILE_TYPE_STYLES[fileTypeKey(fileType)] || { badge: "文", bg: "#718b7f" };
  const dims =
    size === "lg"
      ? "h-12 w-12 rounded-xl text-lg"
      : size === "sm"
        ? "h-8 w-8 rounded-lg text-xs"
        : "h-10 w-10 rounded-xl text-sm";
  return (
    <span
      className={`flex shrink-0 select-none items-center justify-center font-bold text-white shadow-sm ${dims}`}
      style={{ backgroundColor: style.bg }}
      aria-hidden="true"
    >
      {style.badge}
    </span>
  );
}
