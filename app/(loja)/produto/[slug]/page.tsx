import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductView from "@/components/product/ProductView";
import ProductCard from "@/components/ui/ProductCard";
import { getAllProducts, getCategory, getProduct } from "@/lib/server/catalog";
import { isExtra } from "@/lib/extras";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMeta, productLd } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/produto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Produto não encontrado", robots: { index: false, follow: false } };
  const desc = [p.subtitle, p.description].filter(Boolean).join(". ").replace(/\.\./g, ".");
  return {
    // A imagem de compartilhamento vem de opengraph-image.tsx desta rota (foto + nome + preço).
    ...pageMeta({ title: p.name, description: desc, path: `/produto/${p.slug}`, image: false }),
    other: { "product:price:amount": (p.priceCents / 100).toFixed(2), "product:price:currency": "BRL", "product:brand": "BORA" },
  };
}

export default async function ProductPage({ params }: PageProps<"/produto/[slug]">) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const [category, all] = await Promise.all([getCategory(p.categorySlug), getAllProducts()]);
  const related = all.filter((x) => x.id !== p.id && !isExtra(x)).sort((a, b) => Number(b.categorySlug === p.categorySlug) - Number(a.categorySlug === p.categorySlug)).slice(0, 4);

  const crumbs = [{ name: "Início", path: "/" }, ...(category ? [{ name: category.name, path: `/colecao/${category.slug}` }] : []), { name: p.name, path: `/produto/${p.slug}` }];

  return (
    <>
      <JsonLd data={[productLd(p, category?.name), breadcrumbLd(crumbs)]} />
      <div className="wrap pt-0 sm:pt-6 pb-24 lg:pb-0">
        <nav className="hidden lg:block text-sm text-ink-3 mb-6" aria-label="Trilha">
          <Link href="/" className="hover:text-ink">Início</Link> / {category ? <><Link href={`/colecao/${category.slug}`} className="hover:text-ink">{category.name}</Link> / </> : null}<span className="text-ink">{p.name}</span>
        </nav>
        <ProductView p={p} />
      </div>
      <section className="wrap mt-16 lg:mt-24">
        <p className="eyebrow">Combina com</p>
        <h2 className="display text-[clamp(32px,4.4vw,56px)] mt-2">Complete o uniforme</h2>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
          {related.map((r) => <ProductCard key={r.id} p={r} />)}
        </div>
      </section>
    </>
  );
}
