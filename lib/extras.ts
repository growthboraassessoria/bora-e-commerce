// Extras: produtos vendidos como "leve junto" (ex.: CARBS Gel). Não aparecem na vitrine (home, coleções, busca,
// sugestões); entram como oferta na sacola e no checkout, retirados junto com o pedido.
// Um produto vira extra com a etiqueta "extra" (dá para marcar no cadastro do BORA OS).
import type { Product } from "./types";

export const EXTRA_TAG = "extra";

export const isExtra = (p: Pick<Product, "tags">) => (p.tags ?? []).includes(EXTRA_TAG);

/** Oferta pronta para a sacola/checkout (vem no orçamento do servidor). */
export type ExtraOffer = {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  subtitle: string;
  image: string;
  priceCents: number;
  compareAtCents: number | null;
  /** Unidades dentro do pack (detalhe "Sachês por pack" / "Unidades"), para o "por unidade". */
  units: number | null;
  stock: number;
  /** Já está na sacola (o cartão mostra "adicionado" e deixa tirar). */
  inCart: boolean;
};

/** Unidades do pack lidas dos detalhes do produto (ex.: { label: "Sachês por pack", value: "5" }). */
export function packUnits(p: Pick<Product, "details">): number | null {
  const d = p.details.find((x) => /(sach[eê]s|unidades)/i.test(x.label));
  const n = d ? parseInt(d.value, 10) : NaN;
  return Number.isFinite(n) && n > 1 ? n : null;
}

export const offPct = (o: Pick<ExtraOffer, "priceCents" | "compareAtCents">) =>
  o.compareAtCents && o.compareAtCents > o.priceCents ? Math.round((1 - o.priceCents / o.compareAtCents) * 100) : 0;
