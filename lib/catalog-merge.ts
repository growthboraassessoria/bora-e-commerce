// Modo local (sem banco): o cadastro feito no BORA OS fica na chave "catalog" do .data/loja.json.
// Mesmo formato e mesma regra do OS (BORA OS/lib/loja/catalog-merge.ts): mudou lá, muda aqui.
//   products            produtos novos e editados (produto completo, por id)
//   removed             produtos excluídos (ids)
//   collections         coleções novas e editadas (por id)
//   removedCollections  coleções excluídas (ids)
//   links               vínculo coleção → produtos, na ordem (presente = vale; ausente = vem da categoria e das etiquetas)
import type { Category, Product } from "./types";

export type LocalCatalog = {
  products?: Record<string, Product & { variants: (Product["variants"][number] & { archived?: boolean })[] }>;
  removed?: string[];
  collections?: Record<string, Category>;
  removedCollections?: string[];
  links?: Record<string, string[]>;
};

/** Vínculos tirados do catálogo semente: categoria principal + etiquetas com o slug de uma coleção. */
export function seedLinks(products: Product[], categories: Category[]) {
  const links: Record<string, string[]> = {};
  const byPos = [...products].sort((a, b) => a.position - b.position);
  for (const c of categories) links[c.slug] = byPos.filter((p) => p.categorySlug === c.slug || p.tags.includes(c.slug)).map((p) => p.id);
  return links;
}

export function mergeCatalog(seedProducts: Product[], seedCategories: Category[], cat?: LocalCatalog | null) {
  const gone = new Set(cat?.removed ?? []);
  const goneCol = new Set(cat?.removedCollections ?? []);
  const over = cat?.products ?? {};
  const cols = cat?.collections ?? {};

  const categories = [
    ...seedCategories.filter((c) => !goneCol.has(c.id)).map((c) => cols[c.id] ?? c),
    ...Object.values(cols).filter((c) => !seedCategories.some((s) => s.id === c.id) && !goneCol.has(c.id)),
  ].sort((a, b) => a.position - b.position);

  const merged = [
    ...seedProducts.filter((p) => !gone.has(p.id)).map((p) => over[p.id] ?? p),
    ...Object.values(over).filter((p) => !seedProducts.some((s) => s.id === p.id) && !gone.has(p.id)),
  ];

  const links = cat?.links ?? seedLinks(merged, categories);
  const products: Product[] = merged.map((p) => {
    const collections: string[] = [];
    const collectionPos: Record<string, number> = {};
    for (const c of categories) {
      const i = (links[c.slug] ?? []).indexOf(p.id);
      if (i >= 0) {
        collections.push(c.slug);
        collectionPos[c.slug] = i;
      }
    }
    return { ...p, collections, collectionPos, variants: p.variants.filter((v) => !(v as { archived?: boolean }).archived) };
  });
  return { products, categories };
}
