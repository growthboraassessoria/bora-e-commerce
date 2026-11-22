import Link from "next/link";
import Image from "next/image";
import { SALES_OPEN, STORE, waLink } from "@/lib/config";
import { WhatsIcon } from "./SoonCTA";
import Newsletter from "./Newsletter";
import Logo from "./Logo";
import PaymentIcons from "./PaymentIcons";
import { TrackedA } from "./Tracked";

export default function Footer() {
  return (
    <footer className="bg-ink text-white mt-24 relative overflow-hidden">
      <Image src="/img/marca/pattern-bora-white.webp" alt="" width={900} height={1000} className="absolute -right-40 -top-20 w-[720px] opacity-[0.06] pointer-events-none select-none" />
      <div className="wrap relative py-16 grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo white className="h-7 w-auto" />
          <p className="mt-3 text-white/70">{STORE.tagline}</p>
          <p className="mt-8 text-3xl font-black uppercase leading-[0.95] tracking-tight max-w-sm">Primeiro a saber<br />do próximo <span className="text-neon">drop.</span></p>
          <div className="mt-6">{SALES_OPEN ? <Newsletter dark /> : <TrackedA event="whatsapp_click" props={{ location: "rodape_drop" }} href={waLink("Oi! Quero ser avisado dos próximos drops da BORA.")} target="_blank" rel="noopener noreferrer" className="btn btn-neon"><WhatsIcon /> Avise-me no WhatsApp</TrackedA>}</div>
        </div>
        <div>
          <p className="eyebrow text-white/50">Loja</p>
          <ul className="mt-4 grid gap-2.5 text-white/80">
            <li><Link href="/volta-18k" className="hover:text-neon">Pré-venda Volta 18K</Link></li>
            <li><Link href="/produto/camiseta-letz-bora-algodao" className="hover:text-neon">Camiseta LETZ BORA</Link></li>
            <li><Link href="/produto/regata-cropped-bora" className="hover:text-neon">Regata Cropped BORA</Link></li>
            <li><Link href="/colecao/todos" className="hover:text-neon">Todos os produtos</Link></li>
            <li><Link href="/experiencia" className="hover:text-neon">Experiência 3D</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white/50">Ajuda</p>
          <ul className="mt-4 grid gap-2.5 text-white/80">
            <li><Link href="/meus-pedidos" className="hover:text-neon">Meus pedidos</Link></li>
            <li><Link href="/politicas/trocas-e-devolucoes" className="hover:text-neon">Trocas e devoluções</Link></li>
            <li><Link href="/politicas/entrega" className="hover:text-neon">Retirada no evento</Link></li>
            <li><Link href="/politicas/pagamento" className="hover:text-neon">Pagamento</Link></li>
            <li><Link href="/politicas/privacidade" className="hover:text-neon">Privacidade</Link></li>
            <li><Link href="/politicas/termos" className="hover:text-neon">Termos de uso</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white/50">Contato</p>
          <ul className="mt-4 grid gap-2.5 text-white/80">
            <li><a href={`mailto:${STORE.email}`} className="hover:text-neon break-all">{STORE.email}</a></li>
            <li><TrackedA event="whatsapp_click" props={{ location: "rodape" }} href={STORE.whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-neon">WhatsApp {STORE.whatsapp}</TrackedA></li>
            <li><a href={STORE.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-neon">{STORE.instagramHandle}</a></li>
          </ul>
        </div>
      </div>
      <div className="wrap relative border-t border-white/10 py-6 flex flex-col md:flex-row gap-4 md:items-center justify-between text-xs text-white/50">
        <p>© {new Date().getFullYear()} {STORE.legalName} · CNPJ {STORE.cnpj}</p>
        <div className="flex flex-wrap items-center gap-3 text-white/70"><PaymentIcons /><span>Pagamento processado pela Pagar.me</span></div>
      </div>
    </footer>
  );
}
