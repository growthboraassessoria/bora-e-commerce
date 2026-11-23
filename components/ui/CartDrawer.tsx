"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { cart, cartCount, useCart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import { useQuote } from "@/lib/useQuote";
import { brl } from "@/lib/money";
import LineItem from "./LineItem";
import ExtraOffer from "./ExtraOffer";
import { PICKUP } from "@/lib/presale";
import { CloseIcon, LockIcon } from "./Icons";
import CartBagIcon from "./CartBagIcon";
import { useIsPhone, useSheetDrag } from "./ios";

export default function CartDrawer() {
  const { lines, open } = useCart();
  const { quote, loading } = useQuote({ lines }, open && lines.length > 0);

  // view_cart: uma vez a cada abertura da gaveta, quando o orçamento chega.
  const viewed = useRef(false);
  useEffect(() => {
    if (!open) { viewed.current = false; return; }
    if (viewed.current || !quote || !quote.lines.length) return;
    viewed.current = true;
    track("view_cart", { location: "gaveta", value: quote.totals.subtotalCents / 100, currency: "BRL", items: quote.lines.map((l) => ({ item_id: l.productId, item_name: l.name, item_variant: l.variantLabel, price: l.unitCents / 100, quantity: l.quantity })) });
  }, [open, quote]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const count = cartCount(lines);
  const priced = quote?.lines ?? [];
  // Celular: a sacola é uma folha que sobe de baixo e fecha arrastando para baixo. Do tablet para cima, gaveta à direita.
  const phone = useIsPhone();
  const drag = useSheetDrag(() => cart.close(), phone);

  return (
    <div className={`fixed inset-0 z-[60] overflow-hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
      <div className={`absolute inset-0 bg-black/35 sm:bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} onClick={() => cart.close()} />
      <aside
        role="dialog"
        aria-label="Sacola"
        style={drag.style}
        className={`absolute inset-x-0 bottom-0 max-h-[92svh] rounded-t-[28px] sm:rounded-none sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none w-full sm:max-w-[440px] bg-white flex flex-col shadow-2xl ${drag.dragging ? "" : "transition-transform duration-500 ease-out-expo"} ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"} ${lines.length === 0 ? "min-h-[56svh] sm:min-h-0" : "min-h-[70svh] sm:min-h-0"}`}
      >
        <header className="shrink-0 touch-none sm:touch-auto border-b border-line" {...drag.handlers}>
          <span className="sheet-grabber mt-2.5 sm:hidden" aria-hidden />
          <div className="flex items-center justify-between px-5 sm:px-6 h-14 sm:h-16">
            <p className="font-black uppercase tracking-tight text-lg">Sacola {count ? <span className="text-ink-3 font-bold">({count})</span> : null}</p>
            <button type="button" onClick={() => cart.close()} aria-label="Fechar" className="pressable size-11 -mr-2 grid place-items-center rounded-full bg-sand sm:bg-transparent sm:hover:bg-sand"><CloseIcon size={20} /></button>
          </div>
        </header>

        {lines.length === 0 ? (
          <div className="flex-1 grid place-items-center px-8 py-10 text-center pb-[max(2.5rem,env(safe-area-inset-bottom))]">
            <div>
              <div className="mx-auto size-16 rounded-full bg-sand grid place-items-center"><CartBagIcon size={32} /></div>
              <p className="mt-5 text-xl font-black uppercase">Sua sacola está vazia</p>
              <p className="mt-2 text-ink-2">Bora escolher a primeira peça?</p>
              <Link href="/colecao/todos" onClick={() => cart.close()} className="btn btn-primary mt-6">Ver a coleção</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 sm:px-6 py-3 border-b border-line">
              <p className="text-sm leading-snug"><strong>Retirada no evento</strong> · {PICKUP.address}</p>
            </div>
            <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 divide-y divide-line transition-opacity ${loading && !quote ? "opacity-40" : ""}`}>
              {priced.map((l) => <LineItem key={l.variantId} line={l} compact onNavigate={() => cart.close()} />)}
              {(quote?.extras ?? []).filter((o) => !o.inCart).map((o) => <div key={o.productId} className="py-4"><ExtraOffer offer={o} location="gaveta" /></div>)}
              {!quote ? <p className="py-8 text-center text-ink-3">Carregando…</p> : null}
            </div>
            <footer className="shrink-0 border-t border-line px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-white">
              <div className="flex justify-between items-baseline text-ink-2"><span>Subtotal</span><span className="text-lg font-black text-ink">{quote ? brl(quote.totals.subtotalCents) : "…"}</span></div>
              <p className="text-[13px] text-ink-3 mt-0.5">Sem frete: retirada grátis no evento. Cupom no checkout.</p>
              <Link href="/checkout" onClick={() => cart.close()} className="btn btn-primary btn-lg btn-block mt-4"><LockIcon size={18} /> Finalizar compra</Link>
              <Link href="/carrinho" onClick={() => cart.close()} className="pressable flex items-center justify-center h-11 text-[15px] font-bold mt-1 underline underline-offset-4">Ver sacola completa</Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
