export function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? <p className="mb-2 text-sm font-semibold text-brand-sageDark">{eyebrow}</p> : null}
      <h1 className="text-3xl font-bold tracking-normal text-brand-ink md:text-4xl">{title}</h1>
      {description ? <p className="mt-3 max-w-3xl leading-7 text-neutral-600">{description}</p> : null}
    </div>
  );
}
