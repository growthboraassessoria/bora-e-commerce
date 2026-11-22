// Opções e variantes no padrão da Shopify (Cor, Tamanho, Estilo...). Serve para servidor e navegador.
// Produto antigo (sem "options" gravado) vira Cor + Tamanho a partir de color/size das variantes.
import type { Product, ProductOption, Variant } from "./types";

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG", "34-38", "39-43", "U"];

export const isColorOption = (name: string) => /^(cor|cores|color|colou?r)$/i.test(name.trim());
export const isSizeOption = (name: string) => /^(tamanho|tamanhos|tam\.?|size)$/i.test(name.trim());

/** Opções do produto, sempre na ordem do cadastro. */
export function productOptions(p: Pick<Product, "options" | "variants">): ProductOption[] {
  if (p.options?.length) return p.options.filter((o) => o.name && o.values?.length);
  const colors = [...new Map(p.variants.filter((v) => v.color).map((v) => [v.color, v.colorHex])).entries()];
  const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean))].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  const out: ProductOption[] = [];
  if (colors.length) out.push({ name: "Cor", values: colors.map(([value, hex]) => ({ value, hex })) });
  if (sizes.length) out.push({ name: "Tamanho", values: sizes.map((value) => ({ value })) });
  return out;
}

/** Valor de cada opção da variante (preenche Cor/Tamanho a partir de color/size quando falta). */
export function variantOptions(v: Variant, opts: ProductOption[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of opts) {
    const val = v.options?.[o.name] ?? (isColorOption(o.name) ? v.color : isSizeOption(o.name) ? v.size : "");
    if (val) out[o.name] = val;
  }
  return out;
}

/** "Preto · Cropped · M": opções na ordem, com o tamanho por último (o OS lê o tamanho no fim do rótulo). */
export function optionsLabel(values: Record<string, string>, opts: { name: string }[]) {
  const names = opts.length ? opts.map((o) => o.name) : Object.keys(values);
  const size = names.find(isSizeOption);
  const parts = names.filter((n) => n !== size).map((n) => values[n]).filter(Boolean);
  if (size && values[size]) parts.push(values[size] === "U" ? "Tamanho único" : values[size]);
  return parts.join(" · ");
}

/** O produto só usa Cor e/ou Tamanho (a compra rápida do card e o checkout sabem lidar). */
export const simpleOptions = (p: Pick<Product, "options" | "variants">) =>
  productOptions(p).every((o) => isColorOption(o.name) || isSizeOption(o.name) || o.values.length <= 1);
