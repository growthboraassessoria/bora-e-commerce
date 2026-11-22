// Gera supabase/seed.sql a partir de lib/catalog-seed.ts. Uso: node scripts/gen-seed-sql.mjs
import { writeFileSync } from "node:fs";
const { CATEGORIES, PRODUCTS, COUPONS } = await import("../lib/catalog-seed.ts");
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(",")}]::text[]`;
const out = ["-- Gerado por scripts/gen-seed-sql.mjs. Preços e estoques provisórios.", "begin;"];
for (const c of CATEGORIES)
  out.push(`insert into loja.categories (id, slug, name, description, image, position) values (${q(c.id)}, ${q(c.slug)}, ${q(c.name)}, ${q(c.description)}, ${q(c.image)}, ${c.position}) on conflict (id) do update set name = excluded.name, description = excluded.description, image = excluded.image, position = excluded.position;`);
for (const p of PRODUCTS) {
  out.push(`insert into loja.products (id, slug, name, subtitle, description, category_slug, price_cents, compare_at_cents, badges, tags, featured, highlights, details, care, position, status) values (${q(p.id)}, ${q(p.slug)}, ${q(p.name)}, ${q(p.subtitle)}, ${q(p.description)}, ${q(p.categorySlug)}, ${p.priceCents}, ${p.compareAtCents ?? "null"}, ${arr(p.badges)}, ${arr(p.tags)}, ${p.featured}, ${arr(p.highlights)}, ${q(JSON.stringify(p.details))}::jsonb, ${q(p.care)}, ${p.position}, ${q(p.status ?? "active")}) on conflict (id) do update set status = excluded.status;`);
  out.push(`delete from loja.product_images where product_id = ${q(p.id)};`);
  p.images.forEach((i, n) => out.push(`insert into loja.product_images (product_id, url, alt, color, position) values (${q(p.id)}, ${q(i.url)}, ${q(i.alt)}, ${q(i.color ?? null)}, ${n});`));
  p.variants.forEach((v, n) => out.push(`insert into loja.product_variants (id, product_id, sku, color, color_hex, size, price_cents, stock, position) values (${q(v.id)}, ${q(p.id)}, ${q(v.sku)}, ${q(v.color)}, ${q(v.colorHex)}, ${q(v.size)}, ${v.priceCents ?? "null"}, ${v.stock}, ${n}) on conflict (id) do nothing;`));
}
for (const c of COUPONS)
  out.push(`insert into loja.coupons (code, kind, value, min_subtotal_cents, active, expires_at) values (${q(c.code)}, ${q(c.kind)}, ${c.value}, ${c.minSubtotalCents}, ${c.active}, ${q(c.expiresAt)}) on conflict (code) do nothing;`);
out.push("commit;");
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), out.join("\n") + "\n");
console.log("supabase/seed.sql gerado:", out.length, "linhas");

// Mesmo catálogo em JSON: o BORA OS lê este arquivo quando roda ligado à loja local (LOJA_LOCAL_DIR), sem banco.
const json = {
  products: PRODUCTS.map((p) => ({ id: p.id, slug: p.slug, name: p.name, priceCents: p.priceCents, status: p.status ?? "active", position: p.position, image: p.images[0]?.url ?? "",
    variants: p.variants.map((v, n) => ({ id: v.id, sku: v.sku, color: v.color, size: v.size, priceCents: v.priceCents ?? null, stock: v.stock, position: n })) })),
  coupons: COUPONS.map((c) => ({ code: c.code, kind: c.kind, value: c.value, minSubtotalCents: c.minSubtotalCents, active: c.active, expiresAt: c.expiresAt ?? null, maxUses: c.maxUses ?? null })),
};
writeFileSync(new URL("../supabase/seed.json", import.meta.url), JSON.stringify(json, null, 2) + "\n");
console.log("supabase/seed.json gerado:", json.products.length, "produtos");
