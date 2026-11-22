import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductCard from "@/components/ui/ProductCard";
import CollectionFilters from "@/components/ui/CollectionFilters";
import { getAllProducts, getCategories, getCategory, inCategory, queryProducts, type SortKey } from "@/lib/server/catalog";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, itemListLd, pageMeta } from "@/lib/seo";

const ALL = { slug: "todos", name: "Toda a coleção", description: "Tudo o que a BORA veste no treino, na prova e no dia a dia. Coleção 01 e drop 2026.", image: "/img/marca/bora-house-1280.webp" };
const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG", "34-38", "39-43", "U"];

export async function generateMetadata({ params }: PageProps<"/colecao/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = slug === "todos" ? ALL : await getCategory(slug);
  if (!c) return { title: "Coleção não encontrada", robots: { index: false, follow: false } };
  // Filtros (?cor=, ?tamanho=...) apontam para a coleção sem filtro como canonical.
  return pageMeta({ title: c.name, description: c.description, path: `/colecao/${slug}` });
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/colecao/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters = { cor: one(sp.cor), tamanho: one(sp.tamanho), disponivel: one(sp.disponivel), ordem: one(sp.ordem) };

  const category = slug === "todos" ? ALL : await getCategory(slug);
  if (!category) notFound();
  const categorySlug = slug === "todos" ? undefined : slug;

  const [all, products, categories] = await Promise.all([
    getAllProducts(),
    queryProducts({ category: categorySlug, color: filters.cor, size: filters.tamanho, onlyAvailable: !!filters.disponivel, sort: (filters.ordem as SortKey) || "destaques" }),
    getCategories(),
  ]);
  const scope = categorySlug ? all.filter((p) => inCategory(p, categorySlug)) : all;
  const colors = [...new Map(scope.flatMap((p) => p.variants.filter((v) => v.color).map((v) => [v.color, { name: v.color, hex: v.colorHex }]))).values()];
  const sizes = [...new Set(scope.flatMap((p) => p.variants.map((v) => v.size).filter(Boolean)))].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));

  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "Início", path: "/" }, { name: category.name, path: `/colecao/${slug}` }]), itemListLd(category.name, products)]} />
      <section className="wrap pt-4 lg:pt-6">
        <div className="relative overflow-hidden rounded-[28px] lg:rounded-[32px] bg-ink text-white min-h-[260px] sm:min-h-[360px] flex items-end">
          <Image src={category.image} alt="" fill priority sizes="100vw" className="object-cover opacity-80" />
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />
          <div className="relative p-6 sm:p-12 max-w-2xl">
            <nav className="hidden lg:block text-sm text-white/60" aria-label="Trilha"><Link href="/" className="hover:text-white">Início</Link> / <span className="text-white">{category.name}</span></nav>
            <h1 className="display text-[clamp(40px,7vw,104px)] lg:mt-3">{category.name}</h1>
            <p className="mt-3 text-white/80 text-[17px] sm:text-lg leading-snug">{category.description}</p>
          </div>
        </div>
        <div className="mt-5 lg:mt-6 flex gap-2 overflow-x-auto no-scrollbar snap-x -mx-[var(--gutter)] px-[var(--gutter)] scroll-px-[var(--gutter)]">
          {[{ slug: "todos", name: "Tudo" }, ...categories].map((c) => (
            <Link key={c.slug} href={`/colecao/${c.slug}`} className={`pressable h-11 lg:h-10 px-5 rounded-full text-[15px] lg:text-sm font-bold inline-flex items-center shrink-0 snap-start ${c.slug === slug ? "bg-neon text-black" : "bg-sand hover:bg-sand-2"}`}>{c.name}</Link>
          ))}
        </div>
      </section>

      <section className="wrap mt-4">
        <CollectionFilters base={`/colecao/${slug}`} params={filters} colors={colors} sizes={sizes} count={products.length} />
        {products.length ? (
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
            {products.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
          </div>
        ) : (
          <div className="py-24 text-center">
            <p className="text-2xl font-black uppercase">Nada com esses filtros</p>
            <Link href={`/colecao/${slug}`} className="btn btn-primary mt-6">Limpar filtros</Link>
          </div>
        )}
      </section>
    </>
  );
}
