"use client";
// Barra de abas do celular, no jeito do iOS: fica presa embaixo, translúcida, com a área segura do iPhone.
// Some no desktop (lg), nas páginas de produto (que têm a barra de compra própria) e quando o teclado sobe.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SALES_OPEN } from "@/lib/config";
import { cart, cartCount, useCart } from "@/lib/cart";
import { useKeyboardOpen } from "./ios";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const HomeI = () => (<svg width="24" height="24" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M3.5 10.5 12 3.8l8.5 6.7" /><path d="M5.5 9v10.2c0 .7.5 1.3 1.2 1.3h3.6v-5.6h3.4v5.6h3.6c.7 0 1.2-.6 1.2-1.3V9" /></svg>);
const ShopI = () => (<svg width="24" height="24" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M9 3.5 4 6l1.6 4.2 1.9-.8V20.5h9V9.4l1.9.8L20 6l-5-2.5c-.5 1.4-1.6 2.3-3 2.3s-2.5-.9-3-2.3Z" /></svg>);
const BagI = () => (<svg width="24" height="24" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M5 8h14l-1.1 11.2a2 2 0 0 1-2 1.8H8.1a2 2 0 0 1-2-1.8L5 8Z" /><path d="M9 10.5V6.5a3 3 0 0 1 6 0v4" /></svg>);
const OrdersI = () => (<svg width="24" height="24" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>);
const SearchI = () => (<svg width="24" height="24" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>);

/** Páginas onde a barra de abas não aparece (tela "empurrada" com barra de compra própria). */
export const hidesTabBar = (path: string) => path.startsWith("/produto/") || path.startsWith("/experiencia");

function Tab({ active, label, icon, badge }: { active: boolean; label: string; icon: React.ReactNode; badge?: number }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className={`relative grid place-items-center h-7 w-12 rounded-full transition-colors duration-200 ${active ? "bg-neon text-black" : "text-ink-3"}`}>
        {icon}
        {badge ? <span className="absolute -top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-white text-[11px] font-black grid place-items-center ring-2 ring-white tabular-nums">{badge > 9 ? "9+" : badge}</span> : null}
      </span>
      <span className={`text-[11px] leading-none tracking-[0.01em] ${active ? "font-bold text-ink" : "font-medium text-ink-3"}`}>{label}</span>
    </span>
  );
}

export default function TabBar() {
  const path = usePathname();
  const { lines, open } = useCart();
  const count = cartCount(lines);
  const keyboard = useKeyboardOpen();
  if (hidesTabBar(path)) return null;
  const shop = path.startsWith("/colecao") || path.startsWith("/volta-18k") || path.startsWith("/busca") || path.startsWith("/lancamento");
  const item = "pressable flex-1 h-14 grid place-items-center outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-xl";
  return (
    <nav
      aria-label="Abas"
      className={`lg:hidden fixed inset-x-0 bottom-0 z-[45] bg-white/85 backdrop-blur-xl backdrop-saturate-150 shadow-[0_-0.5px_0_var(--color-line-strong)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] transition-transform duration-300 ease-out-expo ${keyboard ? "translate-y-full" : ""}`}
    >
      <div className="mx-auto max-w-xl flex items-stretch px-2">
        <Link href="/" className={item} aria-current={path === "/" ? "page" : undefined}><Tab active={path === "/"} label="Início" icon={<HomeI />} /></Link>
        <Link href="/colecao/todos" className={item} aria-current={shop ? "page" : undefined}><Tab active={shop} label="Loja" icon={<ShopI />} /></Link>
        {SALES_OPEN ? (
          <button type="button" onClick={() => cart.open()} className={item} aria-label={`Sacola com ${count} ${count === 1 ? "item" : "itens"}`}>
            <Tab active={open || path === "/carrinho"} label="Sacola" icon={<BagI />} badge={count} />
          </button>
        ) : (
          <Link href="/busca" className={item}><Tab active={path.startsWith("/busca")} label="Buscar" icon={<SearchI />} /></Link>
        )}
        <Link href="/meus-pedidos" className={item} aria-current={path === "/meus-pedidos" ? "page" : undefined}><Tab active={path === "/meus-pedidos"} label="Pedidos" icon={<OrdersI />} /></Link>
      </div>
    </nav>
  );
}
