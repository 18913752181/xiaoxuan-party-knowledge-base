import Image from "next/image";

type PreviewSource = {
  name: string;
  image_url?: string | null;
  imageUrl?: string | null;
  sprite_sheet_url?: string | null;
  spriteSheetUrl?: string | null;
  sprite_row?: number | null;
  spriteRow?: number | null;
  sprite_col?: number | null;
  spriteCol?: number | null;
};

export default function DimmoExpressionPreview({ item, className = "" }: { item: PreviewSource; className?: string }) {
  const imageUrl = item.image_url ?? item.imageUrl;
  const sheet = item.sprite_sheet_url ?? item.spriteSheetUrl;
  const row = item.sprite_row ?? item.spriteRow ?? 0;
  const col = item.sprite_col ?? item.spriteCol ?? 0;

  if (imageUrl) {
    return <span className={`relative block h-full w-full ${className}`}><Image src={imageUrl} alt={item.name} fill sizes="(max-width: 640px) 50vw, 220px" className="object-contain" unoptimized /></span>;
  }
  if (!sheet) return <div className={`grid h-full w-full place-items-center bg-[#f4f1ea] text-xs text-[#8a8277] ${className}`}>暂无图片</div>;

  return (
    <div
      role="img"
      aria-label={item.name}
      className={`h-full w-full bg-white bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url(${sheet})`,
        backgroundSize: "500% 500%",
        backgroundPosition: `${col * 25}% ${row * 25}%`
      }}
    />
  );
}
