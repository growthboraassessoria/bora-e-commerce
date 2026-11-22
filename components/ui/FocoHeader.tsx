"use client";
// Cabeçalho do fluxo de compra (checkout, pagamento, obrigado). Sem menu para não tirar a atenção.
// Celular: barra de navegação do iOS, translúcida e presa no topo, com "voltar à sacola" no checkout.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import { LockIcon } from "./Icons";
import { ChevronLeft } from "./ios";

export default function FocoHeader() {
  const path = usePathname();
  const router = useRouter();
  const checkout = path.startsWith("/checkout");
  const logo = (
    <Link href="/" className="pressable flex items-center gap-1.5 lg:gap-2" aria-label="Voltar à loja">
      <Logo className="h-[19px] lg:h-[22px] w-auto" />
      <span className="text-[10px] lg:text-[11px] font-black tracking-[0.18em] lg:tracking-[0.2em] uppercase bg-neon px-1 lg:px-1.5 py-0.5 rounded-[3px] lg:rounded-sm">Store</span>
    </Link>
  );
  return (
    <header className="sticky lg:static top-0 z-40 pt-[env(safe-area-inset-top)] bg-white/80 backdrop-blur-xl backdrop-saturate-150 lg:bg-white shadow-[0_0.5px_0_var(--color-line-strong)] lg:shadow-none lg:border-b lg:border-line">
      <div className="lg:hidden wrap h-[52px] grid grid-cols-[96px_minmax(0,1fr)_96px] items-center">
        {checkout ? (
          <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/carrinho"))} className="pressable -ml-3 h-11 pr-2 flex items-center text-[17px] font-medium" aria-label="Voltar para a sacola">
            <ChevronLeft size={26} /> Sacola
          </button>
        ) : <span />}
        <div className="grid place-items-center">{logo}</div>
        <p className="flex items-center justify-end gap-1.5 text-[13px] font-bold text-ink-2"><LockIcon size={15} /> Seguro</p>
      </div>
      <div className="hidden lg:flex wrap h-16 items-center justify-between">
        {logo}
        <p className="flex items-center gap-2 text-sm font-bold"><LockIcon size={16} /> Compra segura</p>
      </div>
    </header>
  );
}
