import type { Coupon, PricedLine } from "./types";
import { STORE } from "./config";
import { brl } from "./money";

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  pixDiscountCents: number;
  shippingCents: number;
  totalCents: number;
  freeShipping: boolean;
  /** false quando o desconto aplicado não soma com o Pix. */
  pixAllowed: boolean;
};

export type DiscountCheck =
  | { ok: true; discountCents: number; freeShipping: boolean }
  | { ok: false; message: string };

const day = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", ...(sameYear ? {} : { year: "numeric" }), hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " às");
};

/** A linha participa do desconto? (sacola toda, produtos escolhidos ou categorias, incluindo etiquetas). */
export function isEligible(c: Coupon, l: PricedLine) {
  const to = c.appliesTo ?? "all";
  if (to === "products") return (c.productIds ?? []).some((id) => id === l.productId || id === l.slug);
  if (to === "categories") return (c.categorySlugs ?? []).some((slug) => (l.categories ?? []).includes(slug));
  return true;
}

/**
 * Confere as regras do desconto (estado, período, limite, itens elegíveis, requisito mínimo) e calcula o valor.
 * Percentual e valor fixo valem só sobre os itens elegíveis. "Uma vez por CPF" é conferido no servidor (quote).
 */
export function evaluateDiscount(c: Coupon | null, lines: PricedLine[], now = Date.now()): DiscountCheck {
  if (!c) return { ok: false, message: "Cupom inválido." };
  // Desativado no BORA OS (Loja › Descontos): recusado com aviso próprio, diferente de código que não existe.
  if (!c.active) return { ok: false, message: "Cupom desativado." };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { ok: false, message: `Cupom válido a partir de ${day(c.startsAt)}.` };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return { ok: false, message: "Cupom expirado." };
  if (c.maxUses != null && (c.uses ?? 0) >= c.maxUses) return { ok: false, message: "Cupom esgotado." };
  const eligible = lines.filter((l) => isEligible(c, l));
  const scoped = (c.appliesTo ?? "all") !== "all";
  if (!eligible.length) return { ok: false, message: scoped ? "Este cupom não vale para as peças da sua sacola." : "Cupom inválido." };
  const sub = eligible.reduce((s, l) => s + l.unitCents * l.quantity, 0);
  const qty = eligible.reduce((s, l) => s + l.quantity, 0);
  if (sub < (c.minSubtotalCents ?? 0)) return { ok: false, message: `Válido a partir de ${brl(c.minSubtotalCents)} em ${scoped ? "peças participantes" : "produtos"}.` };
  if (qty < (c.minQuantity ?? 0)) return { ok: false, message: `Válido a partir de ${c.minQuantity} ${scoped ? "peças participantes" : "peças"}.` };
  let discountCents = 0;
  if (c.kind === "percent") discountCents = Math.round((sub * Math.min(100, Math.max(0, c.value))) / 100);
  if (c.kind === "fixed") discountCents = Math.min(Math.max(0, c.value), sub);
  return { ok: true, discountCents, freeShipping: c.kind === "free_shipping" };
}

// Mesma conta no carrinho, no checkout e no servidor (o servidor recalcula tudo com preços do banco).
// O Pix (STORE.pixDiscountPct) entra sobre o valor já com desconto, a não ser que o desconto não combine com o Pix.
export function computeTotals(lines: PricedLine[], opts: { coupon?: Coupon | null; shippingCents?: number; method?: "pix" | "card"; /** % do Pix pelas regras do OS. */ pixPct?: number }): Totals {
  const subtotalCents = lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
  const check = opts.coupon ? evaluateDiscount(opts.coupon, lines) : null;
  const applied = check?.ok ? check : null;
  const discountCents = applied?.discountCents ?? 0;
  const freeShipping = !!applied?.freeShipping || subtotalCents >= STORE.freeShippingCents;
  const pixAllowed = !applied || opts.coupon?.combinesWithPix !== false;
  const shippingCents = opts.shippingCents ?? 0;
  const afterDiscount = subtotalCents - discountCents;
  const pixDiscountCents = opts.method === "pix" && pixAllowed ? Math.round((afterDiscount * (opts.pixPct ?? STORE.pixDiscountPct)) / 100) : 0;
  return { subtotalCents, discountCents, pixDiscountCents, shippingCents, totalCents: afterDiscount - pixDiscountCents + shippingCents, freeShipping, pixAllowed };
}
