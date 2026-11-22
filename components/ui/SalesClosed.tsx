// Tela da sacola e do checkout enquanto a loja é vitrine (vendas fechadas).
import Link from "next/link";
import { waLink } from "@/lib/config";
import { PRESALE } from "@/lib/presale";
import { WhatsIcon } from "./SoonCTA";
import { TrackedA } from "./Tracked";

export default function SalesClosed() {
  return (
    <div className="wrap py-24 sm:py-32 text-center max-w-2xl">
      <span className="chip chip-neon">Pré-venda em breve</span>
      <h1 className="display text-[clamp(40px,7vw,80px)] mt-6">A compra abre<br /><span className="mark">em breve.</span></h1>
      <p className="mt-6 text-lg text-ink-2">A pré-venda {PRESALE.name} · {PRESALE.edition} ainda não começou. Chama a gente no WhatsApp que avisamos você assim que abrir.</p>
      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <TrackedA event="whatsapp_click" props={{ location: "vendas_fechadas" }} href={waLink(`Oi! Quero ser avisado quando abrir a pré-venda ${PRESALE.name}.`)} target="_blank" rel="noopener noreferrer" className="btn btn-neon btn-lg"><WhatsIcon /> Avise-me no WhatsApp</TrackedA>
        <Link href={PRESALE.path} className="btn btn-ghost btn-lg">Ver as peças</Link>
      </div>
    </div>
  );
}
