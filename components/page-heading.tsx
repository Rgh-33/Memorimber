export function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <section className="pt-8 text-left">
      <p className="text-xs font-semibold leading-5 tracking-[0.14em] text-coral print:hidden">{eyebrow}</p>
      <h1 className="mt-2 text-[28px] font-bold leading-[1.4] tracking-[0.04em] text-ink">{title}</h1>
    </section>
  );
}
