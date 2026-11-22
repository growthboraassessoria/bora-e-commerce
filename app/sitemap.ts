import type { MetadataRoute } from "next";
import { getAllProducts, getCategories } from "@/lib/server/catalog";
import { db, storeMode } from "@/lib/server/db";
import { POLICIES, POLICY_UPDATED } from "@/lib/policies";
import { PRESALE } from "@/lib/presale";
import { SITE_URL } from "@/lib/config";

// Mapa do site para o Google. Só entra o que está à venda (produto ativo, coleção com produto).
// As páginas continuam fora do Google até NEXT_PUBLIC_SITE_INDEXABLE=1 (robots.txt e noindex).

/** Data da última mudança de cada produto (só no banco; no modo local não há data). Só leitura. */
async function productDates(): Promise<Record<string, string>> {
  if (storeMode() !== "supabase") return {};
  try {
    const { data, error } = await db().from("products").select("slug, updated_at").eq("status", "active");
    if (error || !data) return {};
    return Object.fromEntries((data as { slug: string; updated_at: string | null }[]).filter((r) => r.updated_at).map((r) => [r.slug, r.updated_at!]));
  } catch {
    return {};
  }
}

const policyDate = () => {
  const [d, m, y] = POLICY_UPDATED.split("/").map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : undefined;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, dates] = await Promise.all([getAllProducts(), getCategories(), productDates()]);
  const u = (path: string) => `${SITE_URL}${path}`;
  const newest = Object.values(dates).sort().pop();
  const hasKit = products.some((p) => p.slug === "kit-letz-bora");
  return [
    { url: u("/"), priority: 1, changeFrequency: "daily", ...(newest ? { lastModified: newest } : {}) },
    { url: u(PRESALE.path), priority: 0.95, changeFrequency: "daily" },
    { url: u("/colecao/todos"), priority: 0.8, changeFrequency: "weekly" },
    ...categories.map((c) => ({ url: u(`/colecao/${c.slug}`), priority: 0.8, changeFrequency: "weekly" as const })),
    ...(hasKit ? [{ url: u("/lancamento/kit-letz-bora"), priority: 0.8, changeFrequency: "weekly" as const }] : []),
    ...products.map((p) => ({
      url: u(`/produto/${p.slug}`),
      priority: 0.8,
      changeFrequency: "weekly" as const,
      ...(dates[p.slug] ? { lastModified: dates[p.slug] } : {}),
      images: p.images.slice(0, 6).map((i) => (/^https?:\/\//.test(i.url) ? i.url : u(i.url))),
    })),
    { url: u("/experiencia"), priority: 0.6, changeFrequency: "monthly" },
    ...POLICIES.map((p) => ({ url: u(`/politicas/${p.slug}`), priority: 0.3, changeFrequency: "yearly" as const, lastModified: policyDate() })),
    // Consulta de pedidos: no mapa, sem prioridade.
    { url: u("/meus-pedidos") },
  ];
}

// Catálogo e estoque vêm do banco: o mapa é refeito a cada 60 s.
export const revalidate = 60;
