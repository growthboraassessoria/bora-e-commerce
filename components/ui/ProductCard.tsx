import { SALES_OPEN } from "@/lib/config";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { simpleOptions } from "@/lib/options";
import Price from "./Price";
import QuickAdd from "./QuickAdd";
import { TrackedLink } from "./Tracked";

export default function ProductCard({ p, priority = false }: { p: Product; priority?: boolean }) {
  const colors = [...new Map(p.variants.filter((v) => v.color).map((v) => [v.color, v.colorHex])).entries()];
  const soldOut = p.variants.every((v) => v.stock <= 0);
  const lowStock = !soldOut && p.variants.reduce((s, v) => s + v.stock, 0) <= 10;
  const firstColor = p.variants[0]?.color;
  const sizes = p.variants.filter((v) => v.color === firstColor).map((v) => ({ id: v.id, size: v.size, stock: v.stock }));
  const sel = { item_id: p.id, item_name: p.name, price: p.priceCents / 100, currency: "BRL", location: "card", items: [{ item_id: p.id, item_name: p.name, price: p.priceCents / 100, quantity: 1 }] };
  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-sand">
        <TrackedLink event="select_item" props={sel} href={`/produto/${p.slug}`} aria-label={p.name} className="absolute inset-0">
          <Image src={p.images[0]?.url} alt={p.images[0]?.alt ?? p.name} fill priority={priority} sizes="(min-width:1024px) 25vw, (min-width:640px) 45vw, 90vw" className="object-cover transition-all duration-700 ease-out-expo group-hover:scale-[1.04]" />
          {p.images[1] ? (
            <Image src={p.images[1].url} alt="" fill sizes="(min-width:1024px) 25vw, 45vw" className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          ) : null}
        </TrackedLink>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pointer-events-none">
          {soldOut ? <span className="chip chip-ink">Esgotado</span> : null}
          {p.badges.slice(0, 2).map((b, i) => <span key={b} className={`chip ${i === 0 ? "chip-neon" : "chip-ink"}`}>{b}</span>)}
          {lowStock ? <span className="chip bg-white text-ink">Últimas peças</span> : null}
        </div>
        {SALES_OPEN && !soldOut && simpleOptions(p) ? <QuickAdd sizes={sizes} single={p.variants.length === 1} item={{ id: p.id, name: p.name, priceCents: p.priceCents }} /> : null}
      </div>
      <div className="pt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <TrackedLink event="select_item" props={sel} href={`/produto/${p.slug}`} className="font-bold leading-tight hover:underline underline-offset-4">{p.name}</TrackedLink>
          <p className="text-sm text-ink-3 mt-0.5 truncate">{p.subtitle}</p>
          {colors.length > 1 ? (
            <div className="flex gap-1.5 mt-2" aria-label={`${colors.length} cores`}>
              {colors.map(([name, hex]) => <span key={name} title={name} className="size-4 rounded-full ring-1 ring-black/15" style={{ background: hex }} />)}
            </div>
          ) : null}
        </div>
        <Price cents={p.priceCents} compareAt={p.compareAtCents} size="sm" />
      </div>
    </article>
  );
}
