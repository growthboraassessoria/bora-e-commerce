import type { Metadata } from "next";
import Link from "next/link";
import Experience from "@/components/three/Experience";
import Logo from "@/components/ui/Logo";
import HeaderBag from "@/components/ui/HeaderBag";
import { getAllProducts } from "@/lib/server/catalog";
import { brl } from "@/lib/money";
import type { Station } from "@/components/three/ExperienceScene";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ title: "Experiência 3D", description: "Corra pela loja: uma pista em 3D com cada peça do drop 2026 da BORA. Role a página e vá até a chegada.", path: "/experiencia" });

const STORY: Record<string, Omit<Station, "slug" | "name" | "subtitle" | "price" | "image">> = {
  "camiseta-letz-bora-algodao": { kicker: "Pré-venda Volta 18K", title: "From: Dry Lake.", text: "To: all over the world. A camiseta de algodão com o selo LETZ BORA nas costas: running is a lifestyle, beyond the pace." },
  "regata-cropped-bora": { kicker: "Pré-venda Volta 18K", title: "Beyond the pace.", text: "Regata cropped preta em tecido performance, com as curvas de nível neon da marca em volta do raio. Leve, seca rápido, se vê de longe." },
  "camiseta-dri-fit-bora": { kicker: "Começo", title: "Ninguém precisa estar pronto.", text: "A camiseta que veste o primeiro treino e a centésima prova. Leve, seca rápido e grita letz BORAAA!! nas costas." },
  "corta-vento-bora": { kicker: "Coragem", title: "5h da manhã. Vento. Bora.", text: "Para o treino que começa antes do sol e para a volta depois da chegada. Dobra pequeno e vai na mochila." },
  "macaquinho-tri-bora": { kicker: "Constância", title: "Nada, pedala, corre.", text: "Uma peça para a prova inteira. Forro de secagem rápida e as três faixas neon que a torcida reconhece de longe." },
  "bone-five-panel-bora": { kicker: "Detalhe", title: "Leve na cabeça.", text: "Five panel ultraleve com aba flexível. As curvas de nível da marca na lateral." },
  "meia-bora-cano-alto": { kicker: "Comunidade", title: "Ir junto transforma.", text: "Três cores, a mesma pegada. Compressão leve no arco e o grito da marca no cano." },
};

export default async function ExperiencePage() {
  const products = await getAllProducts();
  const stations: Station[] = products
    .filter((p) => STORY[p.slug] && p.slug !== "meia-bora-cano-alto")
    .map((p) => ({ slug: p.slug, name: p.name, subtitle: p.subtitle, price: brl(p.priceCents), image: p.images[0].url.replace("-1600", "-800"), ...STORY[p.slug] }));
  return (
    <div className="bg-sand">
      <Experience stations={stations} />
      <header className="pointer-events-none fixed inset-x-0 top-0 z-10">
        <div className="wrap h-16 flex items-center justify-between">
          <Link href="/" className="pointer-events-auto flex items-center gap-2" aria-label="Voltar à loja"><Logo className="h-[22px] w-auto" /><span className="text-[11px] font-black tracking-[0.2em] uppercase bg-neon px-1.5 py-0.5 rounded-sm">Store</span></Link>
          <div className="pointer-events-auto flex items-center gap-2">
            <Link href="/colecao/todos" className="btn btn-ghost h-10 px-4 text-sm bg-white/70 backdrop-blur"><span className="hidden sm:inline">Pular para a loja</span><span className="sm:hidden">Loja</span></Link>
            <HeaderBag />
          </div>
        </div>
      </header>
    </div>
  );
}

// Catálogo e estoque vêm do banco: a página é refeita a cada 60 s.
export const revalidate = 60;
