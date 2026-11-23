"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import { useQuote } from "@/lib/useQuote";
import type { Product } from "@/lib/types";
import LineItem from "@/components/ui/LineItem";
import ExtraOffer from "@/components/ui/ExtraOffer";
import PaymentIcons from "@/components/ui/PaymentIcons";
import { PICKUP, pickupWhen } from "@/lib/presale";
import ProductCard from "@/components/ui/ProductCard";
import { LockIcon } from "@/components/ui/Icons";
import { brl } from "@/lib/money";
import { useKeyboardOpen } from "@/components/ui/ios";
import CouponField from "./CouponField";
import { TotalsRows } from "./Summary";

export default function CartPage({ suggestions }: { suggestions: Product[] }) {
  const { lines, coupon } = useCart();
  const { quote } = useQuote({ lines, coupon }, lines.length > 0);
  const keyboard = useKeyboardOpen();
  // view_cart: uma vez por visita à página, quando o orçamento chega.
  const seen = useRef(false);
  useEffect(() => {
    if (seen.current || !quote || !quote.lines.length) return;
    seen.current = true;
    track("view_cart", { location: "pagina", value: quote.totals.totalCents / 100, currency: "BRL", items: quote.lines.map((l) => ({ item_id: l.productId, item_name: l.name, item_variant: l.variantLabel, price: l.unitCents / 100, quantity: l.quantity })) });
  }, [quote]);

  if (lines.length === 0) {
    return (
      <section className="wrap pt-16">
        <div className="text-center max-w-md mx-auto">
          <h1 className="display text-[clamp(40px,6vw,80px)]">Sacola vazia</h1>
          <p className="mt-4 text-ink-2 text-lg">Ninguém precisa estar pronto para começar. Só precisa começar.</p>
          <Link href="/colecao/todos" className="btn btn-primary btn-lg mt-8">Ver a coleção</Link>
        </div>
        <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">{suggestions.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>
    );
  }

  return (
    <section className="wrap pt-6 lg:pt-10 pb-28 lg:pb-0">
      <h1 className="display text-[clamp(40px,6vw,80px)]">Sua sacola</h1>
      <div className="mt-6 lg:mt-8 grid [&>*]:min-w-0 lg:grid-cols-[1fr_420px] gap-10 items-start">
        <div>
          <div className="rounded-2xl bg-sand p-5 text-sm"><strong>Retirada no evento · grátis</strong><br /><span className="text-ink-2">{PICKUP.address} · {PICKUP.city} · {pickupWhen()}</span></div>
          {quote?.stockIssues.length ? <div className="mt-4 rounded-2xl bg-danger/10 text-danger p-4 text-sm font-bold">{quote.stockIssues.map((s) => <p key={s}>{s}</p>)}</div> : null}
          <div className="mt-2 divide-y divide-line">{(quote?.lines ?? []).map((l) => <LineItem key={l.variantId} line={l} />)}</div>
          {(quote?.extras ?? []).filter((o) => !o.inCart).map((o) => <ExtraOffer key={o.productId} offer={o} location="sacola" className="mt-4" />)}
        </div>
        <aside className="card p-5 sm:p-6 lg:sticky lg:top-[calc(var(--header-h)+16px)]">
          <p className="text-xl font-black uppercase tracking-tight">Resumo</p>
          <div className="mt-5 grid gap-4">
            <CouponField quote={quote} code={coupon} />
          </div>
          <div className="mt-6">{quote ? <TotalsRows quote={quote} /> : <p className="text-ink-3">Calculando…</p>}</div>
          <Link href="/checkout" className="btn btn-primary btn-lg btn-block mt-6"><LockIcon size={18} /> Finalizar compra</Link>
          <PaymentIcons className="mt-4 justify-center" />
        </aside>
      </div>

      {/* Celular: barra de finalizar sempre à mão, logo acima da barra de abas */}
      <div className={`lg:hidden fixed inset-x-0 bottom-[var(--tabbar-h)] z-40 bg-white/85 backdrop-blur-xl backdrop-saturate-150 shadow-[0_-0.5px_0_var(--color-line-strong)] px-[var(--gutter)] py-2.5 flex items-center gap-3 transition-[opacity,transform] duration-300 ${keyboard ? "opacity-0 pointer-events-none translate-y-4" : ""}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-3">Total</p>
          <p className="text-lg font-black leading-tight tabular-nums">{quote ? brl(quote.totals.totalCents) : "…"}</p>
        </div>
        <Link href="/checkout" className="btn btn-primary h-12 px-6 shrink-0"><LockIcon size={16} /> Finalizar compra</Link>
      </div>
    </section>
  );
}
