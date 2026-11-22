"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import { useQuote } from "@/lib/useQuote";
import type { Product } from "@/lib/types";
import LineItem from "@/components/ui/LineItem";
import PaymentIcons from "@/components/ui/PaymentIcons";
import { PICKUP, pickupWhen } from "@/lib/presale";
import ProductCard from "@/components/ui/ProductCard";
import { LockIcon } from "@/components/ui/Icons";
import CouponField from "./CouponField";
import { TotalsRows } from "./Summary";

export default function CartPage({ suggestions }: { suggestions: Product[] }) {
  const { lines, coupon } = useCart();
  const { quote } = useQuote({ lines, coupon }, lines.length > 0);
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
    <section className="wrap pt-10">
      <h1 className="display text-[clamp(40px,6vw,80px)]">Sua sacola</h1>
      <div className="mt-8 grid [&>*]:min-w-0 lg:grid-cols-[1fr_420px] gap-10 items-start">
        <div>
          <div className="rounded-2xl bg-sand p-5 text-sm"><strong>Retirada no evento · grátis</strong><br /><span className="text-ink-2">{PICKUP.address} · {PICKUP.city} · {pickupWhen()}</span></div>
          {quote?.stockIssues.length ? <div className="mt-4 rounded-2xl bg-danger/10 text-danger p-4 text-sm font-bold">{quote.stockIssues.map((s) => <p key={s}>{s}</p>)}</div> : null}
          <div className="mt-2 divide-y divide-line">{(quote?.lines ?? []).map((l) => <LineItem key={l.variantId} line={l} />)}</div>
        </div>
        <aside className="card p-6 lg:sticky lg:top-[calc(var(--header-h)+16px)]">
          <p className="text-xl font-black uppercase tracking-tight">Resumo</p>
          <div className="mt-5 grid gap-4">
            <CouponField quote={quote} code={coupon} />
          </div>
          <div className="mt-6">{quote ? <TotalsRows quote={quote} /> : <p className="text-ink-3">Calculando…</p>}</div>
          <Link href="/checkout" className="btn btn-primary btn-lg btn-block mt-6"><LockIcon size={18} /> Finalizar compra</Link>
          <PaymentIcons className="mt-4 justify-center" />
        </aside>
      </div>
    </section>
  );
}
