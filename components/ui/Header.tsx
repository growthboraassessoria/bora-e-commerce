"use client";
import { SALES_OPEN } from "@/lib/config";
import { usePaymentRules } from "@/components/store/PaymentRulesProvider";
import { pixBadge } from "@/lib/payment-rules";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cart, cartCount, useCart } from "@/lib/cart";
import Logo from "./Logo";
import { MenuIcon, SearchIcon } from "./Icons";
import CartBagIcon from "./CartBagIcon";
import { ChevronLeft, ChevronRight, useSheetDrag } from "./ios";

// Telas "raiz" (abas do celular): mostram o menu. As demais são telas "empurradas" e mostram o botão voltar, como no iOS.
const ROOTS = new Set(["/", "/colecao/todos", "/meus-pedidos"]);
// Para onde o voltar leva quando a pessoa chegou direto pelo link (sem tela anterior na loja).
const parentOf = (p: string) => (p.startsWith("/produto/") || p.startsWith("/colecao/") ? "/colecao/todos" : "/");
// Conta as trocas de tela feitas dentro da loja (para saber se dá para voltar no histórico).
let inAppNavs = 0;

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
  const firstPath = useRef(pathname);
  useEffect(() => { if (pathname !== firstPath.current) { inAppNavs += 1; firstPath.current = pathname; } }, [pathname]);
  const back = () => (inAppNavs > 0 ? router.back() : router.push(parentOf(pathname)));
  const isRoot = ROOTS.has(pathname);
  const drag = useSheetDrag(() => setMenu(false));

  // Título grande que "encolhe": quando o título da página (h1) passa por baixo do cabeçalho, ele aparece pequeno no centro.
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    setTitle(null);
    if (pathname === "/") return;
    let io: IntersectionObserver | null = null;
    const t = setTimeout(() => {
      const h1 = document.querySelector("main h1");
      if (!h1) return;
      const text = (h1.textContent || "").replace(/\s+/g, " ").trim();
      const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 52;
      io = new IntersectionObserver(([e]) => setTitle(!e.isIntersecting && e.boundingClientRect.top < headerH ? text : null), { rootMargin: `-${headerH}px 0px 0px 0px` });
      io.observe(h1);
    }, 50);
    return () => { clearTimeout(t); io?.disconnect(); };
  }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);
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
      <header className={`sticky top-0 z-50 pt-[env(safe-area-inset-top)] transition-[background,box-shadow] duration-300 ${scrolled ? "bg-white/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_0.5px_0_var(--color-line-strong)]" : "bg-white"}`}>
        {/* Celular e tablet: barra de navegação do iOS (voltar ou menu | logo ou título | buscar e sacola) */}
        <div className="lg:hidden wrap h-[var(--header-h)] grid grid-cols-[88px_minmax(0,1fr)_88px] items-center">
          {isRoot ? (
            <button type="button" className="pressable -ml-2.5 size-11 grid place-items-center rounded-full" aria-label="Abrir menu" onClick={() => setMenu(true)}><MenuIcon size={22} /></button>
          ) : (
            <button type="button" onClick={back} className="pressable -ml-3 h-11 pr-2 flex items-center gap-0.5 text-[17px] font-medium" aria-label="Voltar"><ChevronLeft size={26} /> <span className="max-[359px]:sr-only">Voltar</span></button>
          )}
          <div className="relative h-full grid place-items-center min-w-0">
            <Link href="/" aria-label="BORA Store, início" className={`flex items-center gap-1.5 transition-[opacity,transform] duration-300 ${title ? "opacity-0 -translate-y-2 pointer-events-none" : ""}`}>
              <Logo className="h-[19px] w-auto" />
              <span className="text-[10px] font-black tracking-[0.18em] uppercase bg-neon px-1 py-0.5 rounded-[3px]">Store</span>
            </Link>
            <p aria-hidden={!title} className={`absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[16px] font-bold truncate transition-[opacity,transform] duration-300 ${title ? "opacity-100" : "opacity-0 translate-y-1 pointer-events-none"}`}>{title}</p>
          </div>
          <div className="flex items-center justify-end -mr-2.5">
            <button type="button" className="pressable size-11 grid place-items-center rounded-full" aria-label="Buscar" onClick={() => setSearch((s) => !s)}><SearchIcon size={22} /></button>
            {SALES_OPEN ? <button type="button" onClick={() => cart.open()} className={`bag-btn pressable relative size-11 grid place-items-center rounded-full ${bump ? "bag-added" : ""}`} aria-label={`Sacola com ${count} itens`}>
              <span className="bag"><CartBagIcon size={24} /></span>
              {count > 0 ? <span className="bag-count absolute top-0 right-0 min-w-5 h-5 px-1 rounded-full bg-neon text-black text-[11px] font-black grid place-items-center ring-2 ring-white">{count}</span> : null}
            </button> : null}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden lg:flex wrap h-[var(--header-h)] items-center gap-4">
          <Link href="/" aria-label="BORA Store, início" className="flex items-center gap-2 shrink-0">
            <Logo className="h-[22px] w-auto" />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase bg-neon px-1.5 py-0.5 rounded-sm">Store</span>
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
          <div className="flex items-center gap-1">
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
            className="wrap pb-3 lg:pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              router.push(`/busca?q=${encodeURIComponent(String(q || ""))}`);
            }}
          >
            <label className="relative block">
              <span className="sr-only">Buscar produtos</span>
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
              <input name="q" type="search" enterKeyHint="search" autoFocus autoComplete="off" placeholder="Buscar camiseta, regata…" className="input pl-12 h-12 lg:h-14 rounded-full bg-sand border-transparent" />
            </label>
          </form>
        ) : null}
      </header>

      {/* Menu do celular: folha que sobe de baixo, com lista agrupada estilo Ajustes. Arraste a alça para fechar. */}
      <div className={`fixed inset-0 z-[70] lg:hidden overflow-hidden ${menu ? "" : "pointer-events-none"}`} aria-hidden={!menu} inert={!menu}>
        <div className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${menu ? "opacity-100" : "opacity-0"}`} onClick={() => setMenu(false)} />
        <aside role="dialog" aria-label="Menu" style={drag.style}
          className={`absolute inset-x-0 bottom-0 max-h-[90svh] flex flex-col rounded-t-[28px] bg-sand shadow-[0_-20px_60px_rgba(0,0,0,.18)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ${drag.dragging ? "" : "transition-transform duration-500 ease-out-expo"} ${menu ? "translate-y-0" : "translate-y-full"} sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(560px,100%)]`}>
          <div className="pt-2.5 pb-2 px-5 shrink-0 touch-none" {...drag.handlers}>
            <span className="sheet-grabber" />
            <div className="mt-3 flex items-center justify-between">
              <Logo className="h-5 w-auto" />
              <button type="button" onClick={() => setMenu(false)} className="pressable h-11 -mr-2 px-2 text-[17px] font-bold">OK</button>
            </div>
          </div>
          <div className="overflow-y-auto overscroll-contain px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
            <nav className="rounded-2xl bg-white overflow-hidden divide-y divide-line" aria-label="Menu">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="row-press flex items-center gap-3 min-h-[52px] px-4 text-[17px] font-bold">
                  <span className="flex-1">{n.label}</span>
                  {n.href === "/volta-18k" && SALES_OPEN ? <span className="chip chip-neon h-6 px-2 text-[11px]">Aberta</span> : null}
                  <ChevronRight className="text-ink-3" />
                </Link>
              ))}
            </nav>
            <Link href="/meus-pedidos" className="row-press mt-4 flex items-center gap-3 min-h-[52px] px-4 rounded-2xl bg-white text-[17px] font-bold"><OrdersIcon /> <span className="flex-1">Meus pedidos</span><ChevronRight className="text-ink-3" /></Link>
            <p className="mt-6 px-4 text-[13px] uppercase tracking-[0.08em] text-ink-3">Ajuda</p>
            <div className="mt-2 rounded-2xl bg-white overflow-hidden divide-y divide-line">
              {[["/politicas/trocas-e-devolucoes", "Trocas e devoluções"], ["/politicas/entrega", "Retirada no evento"], ["/politicas/pagamento", "Pagamento"], ["/politicas/privacidade", "Privacidade"]].map(([href, label]) => (
                <Link key={href} href={href} className="row-press flex items-center min-h-[48px] px-4 text-[16px]"><span className="flex-1">{label}</span><ChevronRight className="text-ink-3" /></Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
