import "server-only";
import { getAllProducts, getAutomaticDiscounts, getDiscountByCode, priceLines, variantImage } from "./catalog";
import { isExtra, packUnits, type ExtraOffer } from "../extras";
import { couponUsedByCpf } from "./orders";
import { computeTotals, evaluateDiscount } from "../pricing";
import { getPaymentRules } from "./settings";
import { pixPct } from "../payment-rules";
import { shippingOptions } from "../shipping";
import type { AppliedDiscount, CartLine, Coupon, PricedLine, ShippingOption } from "../types";
import type { Totals } from "../pricing";

export type Quote = {
  lines: PricedLine[];
  totals: Totals;
  /**
   * Situação do cupom digitado. ok = o código é válido; applied = entrou na conta
   * (um código válido pode ficar de fora quando o desconto automático já dá mais).
   */
  coupon: { code: string; ok: boolean; applied: boolean; message: string | null; kind: Coupon["kind"] | null } | null;
  /** Desconto que entrou na conta (automático ou cupom), para o resumo. */
  discount: AppliedDiscount | null;
  shipping: ShippingOption[];
  selectedShipping: ShippingOption;
  stockIssues: string[];
  /** Extras para oferecer ("leve junto"): com estoque e só quando a sacola já tem outra peça (inCart = já entrou). */
  extras: ExtraOffer[];
};

export type QuoteInput = {
  lines: CartLine[];
  coupon?: string;
  cep?: string;
  shippingId?: string;
  method?: "pix" | "card";
  /** Só no servidor (placeOrder): confere "uma vez por CPF". Nunca vem do navegador. */
  cpf?: string;
  /** Automáticos a ignorar (ex.: já usados neste CPF, avisado pelo placeOrder). */
  exclude?: string[];
};

const applied = (c: Coupon, totals: Totals): AppliedDiscount => ({
  code: c.code, title: c.title?.trim() || c.code, automatic: c.method === "automatic", kind: c.kind,
  discountCents: totals.discountCents, combinesWithPix: c.combinesWithPix !== false,
});

/**
 * Orçamento completo do carrinho: usado pelo carrinho, pelo checkout e pela criação do pedido.
 *
 * Regra dos descontos (um desconto por pedido, como na Shopify sem combinação):
 * 1. Descontos automáticos válidos entram sozinhos; havendo vários, fica o que deixa o total menor
 *    (já contando o Pix quando a forma de pagamento é Pix e o desconto combina com ele).
 * 2. Um cupom digitado substitui o automático só se deixar o total MENOR. Empate ou menos: fica o automático
 *    e o cliente vê o aviso (assim o cupom não gasta o uso dele à toa).
 * 3. O Pix (STORE.pixDiscountPct) entra por cima do valor já descontado, a não ser que o desconto escolhido
 *    tenha combines_with_pix = false.
 */
export async function quote(input: QuoteInput): Promise<Quote> {
  const lines = await priceLines((input.lines ?? []).slice(0, 30));
  const shipping = shippingOptions();
  const selectedShipping = shipping[0];
  const rules = await getPaymentRules();
  const base = { shippingCents: selectedShipping?.cents ?? 0, method: input.method, pixPct: pixPct(rules) };
  const exclude = new Set((input.exclude ?? []).map((c) => c.toUpperCase()));
  const usedByCpf = async (c: Coupon) => !!input.cpf && !!c.oncePerCustomer && (await couponUsedByCpf(c.code, input.cpf));

  // 1) melhor automático
  let best: { c: Coupon; totals: Totals } | null = null;
  if (lines.length) {
    for (const c of await getAutomaticDiscounts()) {
      if (exclude.has(c.code) || !evaluateDiscount(c, lines).ok) continue;
      if (await usedByCpf(c)) continue;
      const totals = computeTotals(lines, { ...base, coupon: c });
      if (!best || totals.totalCents < best.totals.totalCents) best = { c, totals };
    }
  }

  // 2) cupom digitado
  let coupon: Quote["coupon"] = null;
  const code = input.coupon?.trim().toUpperCase();
  if (code) {
    const c = await getDiscountByCode(code);
    const check = evaluateDiscount(c, lines);
    if (!c || !check.ok) {
      coupon = { code, ok: false, applied: false, message: check.ok ? "Cupom inválido." : check.message, kind: c?.kind ?? null };
    } else if (await usedByCpf(c)) {
      coupon = { code, ok: false, applied: false, message: "Este cupom já foi usado no seu CPF.", kind: c.kind };
    } else {
      const totals = computeTotals(lines, { ...base, coupon: c });
      if (best && best.totals.totalCents <= totals.totalCents) {
        coupon = { code, ok: true, applied: false, message: `O desconto automático “${best.c.title?.trim() || best.c.code}” já é melhor que este cupom.`, kind: c.kind };
      } else {
        best = { c, totals };
        coupon = { code, ok: true, applied: true, message: null, kind: c.kind };
      }
    }
  }

  const totals = best?.totals ?? computeTotals(lines, base);
  const discount = best ? applied(best.c, totals) : null;
  const stockIssues = lines.filter((l) => l.quantity > l.stock).map((l) => (l.stock <= 0 ? `${l.name} (${l.variantLabel}) esgotou.` : `${l.name} (${l.variantLabel}): só restam ${l.stock}.`));
  return { lines, totals, coupon, discount, shipping, selectedShipping, stockIssues, extras: await extraOffers(lines) };
}

async function extraOffers(lines: PricedLine[]): Promise<ExtraOffer[]> {
  const all = await getAllProducts();
  const extraIds = new Set(all.filter(isExtra).map((p) => p.id));
  if (!lines.some((l) => !extraIds.has(l.productId))) return [];
  const inCart = new Set(lines.map((l) => l.productId));
  const out: ExtraOffer[] = [];
  for (const p of all) {
    if (!extraIds.has(p.id)) continue;
    const line = lines.find((l) => l.productId === p.id);
    const v = line ? p.variants.find((x) => x.id === line.variantId) : p.variants.find((x) => x.stock > 0);
    if (!v) continue;
    out.push({
      productId: p.id, variantId: v.id, slug: p.slug, name: p.name, subtitle: p.subtitle,
      image: variantImage(p, v).replace("-1600", "-800"), priceCents: v.priceCents ?? p.priceCents,
      compareAtCents: v.compareAtCents ?? p.compareAtCents, units: packUnits(p), stock: v.stock, inCart: inCart.has(p.id),
    });
  }
  return out;
}
