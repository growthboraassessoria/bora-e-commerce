// Tela de senha da loja (loja em modo "senha", configurado no BORA OS).
import Image from "next/image";
import Logo from "@/components/ui/Logo";
import { STORE, waLink } from "@/lib/config";
import { WhatsIcon } from "@/components/ui/SoonCTA";
import { TrackedA } from "@/components/ui/Tracked";
import PasswordForm from "./PasswordForm";

export default function PasswordPage({ message }: { message: string }) {
  return (
    <main className="relative min-h-svh bg-white overflow-hidden flex flex-col">
      <Image src="/img/marca/pattern-bora-white.webp" alt="" width={1200} height={1340} className="absolute -right-56 -bottom-64 w-[820px] opacity-[0.07] invert pointer-events-none select-none" />
      <header className="wrap h-16 flex items-center">
        <span className="flex items-center gap-2">
          <Logo className="h-[22px] w-auto" />
          <span className="text-[11px] font-black tracking-[0.2em] uppercase bg-neon px-1.5 py-0.5 rounded-sm">Store</span>
        </span>
      </header>

      <section className="relative wrap flex-1 grid place-items-center py-12">
        <div className="w-full max-w-md">
          <span className="chip chip-neon">Acesso com senha</span>
          <h1 className="display text-[clamp(44px,9vw,84px)] mt-6">Quase<br /><span className="mark">lá.</span></h1>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed">{message}</p>
          <div className="mt-8 card p-5 sm:p-6 shadow-[var(--shadow-card)]">
            <PasswordForm />
          </div>
          <p className="mt-6 text-sm text-ink-2">
            Não tem a senha?{" "}
            <TrackedA event="whatsapp_click" props={{ location: "senha" }} href={waLink("Oi! Quero a senha da BORA Store.")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-ink underline underline-offset-4">
              <WhatsIcon size={15} /> Fale com a gente no WhatsApp
            </TrackedA>
          </p>
        </div>
      </section>

      <footer className="wrap py-6 text-xs text-ink-3">© {new Date().getFullYear()} {STORE.legalName} · {STORE.tagline}</footer>
    </main>
  );
}
