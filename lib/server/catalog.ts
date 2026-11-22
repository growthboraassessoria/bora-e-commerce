import "server-only";
import { cache } from "react";
import { db, storeMode } from "./db";
import { CATEGORIES, COUPONS, PRODUCTS } from "../catalog-seed";
import { readLocalCoupons, readLocalOrders, readLocalStock } from "./local-store";
import type { Category, Coupon, PricedLine, Product, Variant } from "../types";

// ---------- mapeamento do banco (schema loja) ----------
type ProductRow = {
  id: string; slug: string; name: string; subtitle: string; description: string; category_slug: string;
  price_cents: number; compare_at_cents: number | null; badges: string[]; tags: string[]; featured: boolean;
  highlights: string[]; details: { label: string; value: string }[]; care: string; position: number;
  product_images: { url: string; alt: string; color: string | null; position: number }[];
  product_variants: { id: string; sku: string; color: string; color_hex: string; size: string; price_cents: number | null; stock: number; position: number }[];
};

const PRODUCT_SELECT = "*, product_images(url, alt, color, position), product_variants(id, sku, color, color_hex, size, price_cents, stock, position)";

function fromRow(r: ProductRow): Product {
  return {
    id: r.id, slug: r.slug, name: r.name, subtitle: r.subtitle, description: r.description, categorySlug: r.category_slug,
    priceCents: r.price_cents, compareAtCents: r.compare_at_cents, badges: r.badges ?? [], tags: r.tags ?? [], featured: r.featured,
    highlights: r.highlights ?? [], details: r.details ?? [], care: r.care ?? "", position: r.position,
    images: [...(r.product_images ?? [])].sort((a, b) => a.position - b.position).map((i) => ({ url: i.url, alt: i.alt, color: i.color })),
    variants: [...(r.product_variants ?? [])].sort((a, b) => a.position - b.position).map((v) => ({
      id: v.id, sku: v.sku, color: v.color, colorHex: v.color_hex, size: v.size, priceCents: v.price_cents, stock: v.stock,
    })),
  };
}

async function localProducts(): Promise<Product[]> {
  const stock = await readLocalStock();
  return PRODUCTS.filter((p) => p.status !== "draft").map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, stock: stock[v.id] ?? v.stock })) }));
}

// ---------- leitura ----------
// Só categorias com produto à venda aparecem.
export const getCategories = cache(async (): Promise<Category[]> => {
  let all: Category[];
  if (storeMode() === "local") all = CATEGORIES;
  else {
    const { data, error } = await db().from("categories").select("*").order("position");
    if (error) throw error;
    all = data.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, image: c.image, position: c.position }));
  }
  const products = await getAllProducts();
  return all.filter((c) => products.some((p) => inCategory(p, c.slug)));
});

export const getCategory = cache(async (slug: string) => (await getCategories()).find((c) => c.slug === slug) ?? null);

export const getAllProducts = cache(async (): Promise<Product[]> => {
  if (storeMode() === "local") return localProducts();
  const { data, error } = await db().from("products").select(PRODUCT_SELECT).eq("status", "active").order("position");
  if (error) throw error;
  return (data as ProductRow[]).map(fromRow);
});

export const getProduct = cache(async (slug: string) => (await getAllProducts()).find((p) => p.slug === slug) ?? null);

export type SortKey = "destaques" | "menor-preco" | "maior-preco" | "novidades";

export async function queryProducts(opts: { category?: string; q?: string; sort?: SortKey; color?: string; size?: string; onlyAvailable?: boolean } = {}) {
  let list = await getAllProducts();
  if (opts.category) list = list.filter((p) => inCategory(p, opts.category!));
  if (opts.q) {
    const q = normalize(opts.q);
    list = list.filter((p) => normalize([p.name, p.subtitle, p.description, p.tags.join(" "), p.categorySlug].join(" ")).includes(q));
  }
  if (opts.color) list = list.filter((p) => p.variants.some((v) => v.color === opts.color));
  if (opts.size) list = list.filter((p) => p.variants.some((v) => v.size === opts.size && v.stock > 0));
  if (opts.onlyAvailable) list = list.filter((p) => p.variants.some((v) => v.stock > 0));
  const sorted = [...list];
  if (opts.sort === "menor-preco") sorted.sort((a, b) => a.priceCents - b.priceCents);
  else if (opts.sort === "maior-preco") sorted.sort((a, b) => b.priceCents - a.priceCents);
  else if (opts.sort === "novidades") sorted.sort((a, b) => Number(b.badges.includes("Lançamento")) - Number(a.badges.includes("Lançamento")));
  else sorted.sort((a, b) => Number(b.featured) - Number(a.featured) || a.position - b.position);
  return sorted;
}

// Uma "coleção" (ex.: colecao-01) é uma categoria que reúne produtos pela etiqueta.
export const inCategory = (p: Product, slug: string) => p.categorySlug === slug || p.tags.includes(slug);

export const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function variantLabel(v: Variant) {
  return [v.color, v.size === "U" ? "Tamanho único" : v.size].filter(Boolean).join(" · ");
}

export function variantImage(p: Product, v: Variant) {
  return (p.images.find((i) => i.color === v.color) ?? p.images[0])?.url ?? "";
}

// Preço de cada linha do carrinho, sempre a partir do banco. Linhas com variante inexistente são descartadas.
export async function priceLines(lines: { variantId: string; quantity: number }[]): Promise<PricedLine[]> {
  const products = await getAllProducts();
  const byVariant = new Map<string, { p: Product; v: Variant }>();
  for (const p of products) for (const v of p.variants) byVariant.set(v.id, { p, v });
  const out: PricedLine[] = [];
  for (const l of lines) {
    const hit = byVariant.get(l.variantId);
    if (!hit) continue;
    const q = Math.max(1, Math.min(10, Math.floor(Number(l.quantity) || 1)));
    out.push({
      variantId: hit.v.id, productId: hit.p.id, slug: hit.p.slug, name: hit.p.name, variantLabel: variantLabel(hit.v),
      image: variantImage(hit.p, hit.v), unitCents: hit.v.priceCents ?? hit.p.priceCents, quantity: q, stock: hit.v.stock,
      categories: [hit.p.categorySlug, ...hit.p.tags],
    });
  }
  return out;
}

// ---------- descontos (loja.coupons) ----------
type CouponRow = {
  code: string; title: string | null; method: "code" | "automatic" | null; kind: Coupon["kind"]; value: number;
  applies_to: Coupon["appliesTo"] | null; product_ids: string[] | null; category_slugs: string[] | null;
  min_subtotal_cents: number | null; min_quantity: number | null; active: boolean; starts_at: string | null; expires_at: string | null;
  uses: number | null; max_uses: number | null; once_per_customer: boolean | null; combines_with_pix: boolean | null;
};

function couponFromRow(r: CouponRow): Coupon {
  return {
    code: r.code, title: r.title ?? "", method: r.method ?? "code", kind: r.kind, value: r.value,
    appliesTo: r.applies_to ?? "all", productIds: r.product_ids ?? [], categorySlugs: r.category_slugs ?? [],
    minSubtotalCents: r.min_subtotal_cents ?? 0, minQuantity: r.min_quantity ?? 0, active: r.active,
    startsAt: r.starts_at, expiresAt: r.expires_at, uses: r.uses ?? 0, maxUses: r.max_uses ?? null,
    oncePerCustomer: !!r.once_per_customer, combinesWithPix: r.combines_with_pix ?? true,
  };
}

// Modo local: os usos vêm dos pedidos gravados em .data/loja.json (o banco conta na loja.create_order).
// Os descontos criados, ativados ou desativados no BORA OS (LOJA_LOCAL_DIR) ficam no mesmo arquivo e valem na hora.
async function localCoupons(): Promise<Coupon[]> {
  const [orders, saved] = await Promise.all([readLocalOrders(), readLocalCoupons()]);
  return (saved ?? COUPONS).map((c) => ({ ...c, uses: (c.uses ?? 0) + orders.filter((o) => o.couponCode === c.code).length }));
}

/** Cupom digitado (só descontos do tipo "código"). */
export async function getDiscountByCode(code: string): Promise<Coupon | null> {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  if (storeMode() === "local") return (await localCoupons()).find((x) => x.code === c && (x.method ?? "code") === "code") ?? null;
  const { data, error } = await db().from("coupons").select("*").eq("code", c).maybeSingle();
  if (error) console.error("getDiscountByCode", error.message);
  if (!data) return null;
  const coupon = couponFromRow(data as CouponRow);
  return coupon.method === "code" ? coupon : null;
}

/** Descontos automáticos ativos (as regras de período, limite e requisito são conferidas em evaluateDiscount). */
export const getAutomaticDiscounts = cache(async (): Promise<Coupon[]> => {
  if (storeMode() === "local") return (await localCoupons()).filter((c) => c.method === "automatic" && c.active);
  const { data, error } = await db().from("coupons").select("*").eq("method", "automatic").eq("active", true);
  if (error) {
    console.error("getAutomaticDiscounts", error.message);
    return [];
  }
  return (data as CouponRow[]).map(couponFromRow);
});
