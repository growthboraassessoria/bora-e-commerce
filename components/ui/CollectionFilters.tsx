import Link from "next/link";

type Opt = { value: string; label: string };
const SORTS: Opt[] = [
  { value: "destaques", label: "Destaques" },
  { value: "novidades", label: "Novidades" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
];

// Filtros por link (funcionam sem JavaScript e mantêm a URL compartilhável).
export default function CollectionFilters({ base, params, colors, sizes, count }: { base: string; params: Record<string, string | undefined>; colors: { name: string; hex: string }[]; sizes: string[]; count: number }) {
  const href = (patch: Record<string, string | undefined>) => {
    const next = { ...params, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `${base}?${qs}` : base;
  };
  const chip = (active: boolean) => `pressable h-10 lg:h-9 px-4 shrink-0 rounded-full text-sm font-bold inline-flex items-center gap-2 transition-colors ${active ? "bg-ink text-white" : "ring-1 ring-line hover:ring-ink"}`;
  const anyFilter = params.cor || params.tamanho || params.disponivel;
  return (
    <div className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top))] z-30 bg-white/85 backdrop-blur-xl backdrop-saturate-150 -mx-[var(--gutter)] px-[var(--gutter)] py-3 border-b border-line">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-sm text-ink-3 shrink-0 mr-1 tabular-nums">{count} {count === 1 ? "produto" : "produtos"}</span>
        {colors.map((c) => (
          <Link key={c.name} scroll={false} href={href({ cor: params.cor === c.name ? undefined : c.name })} className={chip(params.cor === c.name)}>
            <span className="size-3.5 rounded-full ring-1 ring-black/20" style={{ background: c.hex }} />{c.name}
          </Link>
        ))}
        <span className="w-px h-6 bg-line mx-1 shrink-0" />
        {sizes.map((s) => (
          <Link key={s} scroll={false} href={href({ tamanho: params.tamanho === s ? undefined : s })} className={chip(params.tamanho === s)}>{s === "U" ? "Único" : s}</Link>
        ))}
        <span className="w-px h-6 bg-line mx-1 shrink-0" />
        <Link scroll={false} href={href({ disponivel: params.disponivel ? undefined : "1" })} className={chip(!!params.disponivel)}>Em estoque</Link>
        {anyFilter ? <Link scroll={false} href={href({ cor: undefined, tamanho: undefined, disponivel: undefined })} className="h-10 inline-flex items-center text-sm font-bold underline underline-offset-4 shrink-0 px-2">Limpar</Link> : null}
        <div className="ml-auto flex items-center gap-1 shrink-0 pl-4">
          {SORTS.map((s) => (
            <Link key={s.value} scroll={false} href={href({ ordem: s.value === "destaques" ? undefined : s.value })} className={`h-10 lg:h-9 px-3 rounded-full text-sm font-bold inline-flex items-center ${(params.ordem ?? "destaques") === s.value ? "bg-sand" : "text-ink-3 hover:text-ink"}`}>{s.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
