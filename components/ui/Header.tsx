"use client";
import { SALES_OPEN } from "@/lib/config";
import { usePaymentRules } from "@/components/store/PaymentRulesProvider";
import { pixBadge } from "@/lib/payment-rules";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cart, cartCount, useCart } from "@/lib/cart";
import Logo from "./Logo";
import { CloseIcon, MenuIcon, SearchIcon } from "./Icons";
import CartBagIcon from "./CartBagIcon";

const NAV = [
  { href: "/volta-18k", label: "Pré-venda Volta 18K" },
  { href: "/produto/camiseta-letz-bora-algodao", label: "Camiseta" },
  { href: "/produto/regata-cropped-bora", label: "Cropped" },
  { href: "/colecao/todos", label: "Loja" },
  { href: "/experiencia", label: "Experiência 3D" },
];

// Ícone de pedido (recibo) para o atalho "Meus pedidos".
function OrdersIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export default function Header() {
  const rules = usePaymentRules();
  const { lines } = useCart();
  const count = cartCount(lines);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setMenu(false); setSearch(false); }, [pathname]);
  // Pula só quando entra peça nova (não ao carregar a página nem ao remover).
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = count;
    if (prev === null || count <= prev) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 950);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <>
      <div className="bg-ink text-white text-[12px] font-bold tracking-[0.12em] uppercase overflow-hidden h-9 flex items-center">
        <div className="flex whitespace-nowrap animate-marquee">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex shrink-0">
              {[SALES_OPEN ? "Pré-venda Volta 18K aberta" : "Pré-venda Volta 18K em breve", "Retirada no evento · Pampulha", pixBadge(rules), rules.cardEnabled && rules.maxInstallments > 1 ? `Até ${rules.maxInstallments}x sem juros` : "", "letz BORAAA!!", "Edição limitada"].filter(Boolean).map((t) => (
                <span key={t + k} className="px-8 flex items-center gap-8">{t}<span className="text-neon">⚡</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <header className={`sticky top-0 z-50 transition-[background,box-shadow] duration-300 ${scrolled ? "bg-white/85 backdrop-blur-xl shadow-[0_1px_0_var(--color-line)]" : "bg-white"}`}>
        <div className="wrap h-[var(--header-h)] flex items-center gap-4">
          <button type="button" className="lg:hidden -ml-2 size-10 grid place-items-center" aria-label="Abrir menu" onClick={() => setMenu(true)}><MenuIcon /></button>
          <Link href="/" aria-label="BORA Store, início" className="flex items-center gap-2 shrink-0">
            <Logo className="h-[22px] w-auto" />
            <span className="hidden sm:inline text-[11px] font-black tracking-[0.2em] uppercase bg-neon px-1.5 py-0.5 rounded-sm">Store</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1 mx-auto" aria-label="Principal">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link key={n.href} href={n.href} className={`px-3 py-2 rounded-full text-[14px] font-bold transition-colors ${active ? "bg-ink text-white" : "hover:bg-sand"} ${n.href === "/experiencia" && !active ? "ring-1 ring-ink/15" : ""} ${n.href === "/volta-18k" && !active ? "bg-neon hover:bg-neon" : ""}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto lg:ml-0 flex items-center gap-1">
            <Link href="/meus-pedidos" aria-label="Meus pedidos" className={`hidden lg:inline-flex h-10 items-center gap-2 px-2.5 xl:px-3 rounded-full text-[14px] font-bold transition-colors ${pathname === "/meus-pedidos" ? "bg-ink text-white" : "hover:bg-sand"}`}>
              <OrdersIcon /><span className="hidden xl:inline">Meus pedidos</span>
            </Link>
            <button type="button" className="size-10 grid place-items-center rounded-full hover:bg-sand" aria-label="Buscar" onClick={() => setSearch((s) => !s)}><SearchIcon /></button>
            {SALES_OPEN ? <button type="button" onClick={() => cart.open()} className={`bag-btn relative size-10 grid place-items-center rounded-full hover:bg-sand ${bump ? "bag-added" : ""}`} aria-label={`Sacola com ${count} itens`}>
              <span className="bag"><CartBagIcon size={24} /></span>
              {count > 0 ? <span className="bag-count absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-neon text-black text-[11px] font-black grid place-items-center ring-2 ring-white">{count}</span> : null}
            </button> : null}
          </div>
        </div>
        {search ? (
          <form
            className="wrap pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              router.push(`/busca?q=${encodeURIComponent(String(q || ""))}`);
            }}
          >
            <label className="relative block">
              <span className="sr-only">Buscar produtos</span>
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
              <input name="q" autoFocus placeholder="Buscar camiseta, corta-vento, meia…" className="input pl-12 h-14 rounded-full bg-sand border-transparent" />
            </label>
          </form>
        ) : null}
      </header>

      <div className={`fixed inset-0 z-[70] lg:hidden overflow-hidden ${menu ? "" : "pointer-events-none"}`} aria-hidden={!menu} inert={!menu}>
        <div className={`absolute inset-0 bg-black/30 transition-opacity ${menu ? "opacity-100" : "opacity-0"}`} onClick={() => setMenu(false)} />
        <aside className={`absolute left-0 top-0 h-full w-[86%] max-w-sm bg-white p-6 flex flex-col transition-transform duration-500 ease-out-expo ${menu ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between">
            <Logo className="h-5 w-auto" />
            <button type="button" aria-label="Fechar menu" className="size-10 grid place-items-center" onClick={() => setMenu(false)}><CloseIcon /></button>
          </div>
          <nav className="mt-10 grid gap-1" aria-label="Menu">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-3xl font-black uppercase tracking-tight py-2">{n.label}</Link>
            ))}
          </nav>
          <Link href="/meus-pedidos" className="mt-6 flex items-center gap-3 rounded-2xl bg-sand px-4 py-3.5 font-bold"><OrdersIcon /> Meus pedidos</Link>
          <div className="mt-auto pt-6 border-t border-line text-sm text-ink-2 grid gap-2">
            <Link href="/politicas/trocas-e-devolucoes">Trocas e devoluções</Link>
            <Link href="/politicas/entrega">Retirada</Link>
            <Link href="/politicas/privacidade">Privacidade</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
