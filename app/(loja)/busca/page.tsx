import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ui/ProductCard";
import { queryProducts } from "@/lib/server/catalog";
import { SearchIcon } from "@/components/ui/Icons";
import { pageMeta } from "@/lib/seo";

// Resultado de busca não vai para o Google (os links dos produtos vão).
export async function generateMetadata({ searchParams }: PageProps<"/busca">): Promise<Metadata> {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 80) ?? "";
  return pageMeta({ title: q ? `Busca: ${q}` : "Busca", description: "Busque camisetas, regatas, acessórios e kits da BORA Store.", path: "/busca", noindex: true });
}

export default async function SearchPage({ searchParams }: PageProps<"/busca">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 80) ?? "";
  const results = q ? await queryProducts({ q }) : [];
  const suggestions = await queryProducts({ sort: "destaques" });
  return (
    <section className="wrap pt-6 lg:pt-10" data-search-count={q ? results.length : undefined}>
      <form action="/busca" role="search" className="max-w-2xl" data-track-form="busca">
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input name="q" type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" defaultValue={q} placeholder="Buscar na loja" className="input h-14 sm:h-16 rounded-full pl-14 text-lg bg-sand border-transparent" />
        </label>
      </form>
      <h1 className="display text-[clamp(32px,5vw,64px)] mt-8 sm:mt-10 [overflow-wrap:anywhere]">
        {q ? <>{results.length} {results.length === 1 ? "resultado" : "resultados"} para <span className="mark">“{q}”</span></> : "O que você procura?"}
      </h1>
      {q && results.length === 0 ? <p className="mt-4 text-ink-2">Tente “camiseta”, “corta-vento” ou “meia”. Ou veja <Link href="/colecao/todos" className="underline">toda a coleção</Link>.</p> : null}
      <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
        {(q && results.length ? results : suggestions).map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}
