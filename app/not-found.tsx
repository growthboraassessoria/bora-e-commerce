import Link from "next/link";
import type { Metadata } from "next";
import { INDEXABLE } from "@/lib/config";
import Header from "@/components/ui/Header";
import TrackOnMount from "@/components/analytics/TrackOnMount";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false, follow: INDEXABLE } };

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="wrap py-24 text-center">
        <TrackOnMount name="page_not_found" />
        <p className="eyebrow">Erro 404</p>
        <h1 className="display text-[clamp(48px,9vw,140px)] mt-4">Saiu da<br /><span className="mark">pista.</span></h1>
        <p className="mt-6 text-lg text-ink-2">Essa página não existe ou a peça saiu da loja.</p>
        <div className="mt-8 flex justify-center gap-3 flex-wrap">
          <Link href="/" className="btn btn-primary btn-lg">Voltar ao início</Link>
          <Link href="/colecao/todos" className="btn btn-ghost btn-lg">Ver a coleção</Link>
        </div>
      </main>
    </>
  );
}
