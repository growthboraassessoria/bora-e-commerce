import { brl } from "@/lib/money";
import type { Quote } from "@/lib/useQuote";

/** Nome da linha de desconto no resumo: "Desconto automático: <título>" ou "Cupom <código>". */
export function discountLabel(quote: Quote) {
  const d = quote.discount;
  if (!d) return "Desconto";
  return d.automatic ? `Desconto automático: ${d.title}` : `Cupom ${d.code}`;
}

export function TotalsRows({ quote, showShipping = true }: { quote: Quote; showShipping?: boolean }) {
  const t = quote.totals;
  return (
    <dl className="grid gap-2.5 text-sm">
      <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd className="font-bold">{brl(t.subtotalCents)}</dd></div>
      {t.discountCents ? <div className="flex justify-between gap-4"><dt className="text-ink-2 min-w-0">{discountLabel(quote)}</dt><dd className="font-bold whitespace-nowrap">− {brl(t.discountCents)}</dd></div> : null}
      {t.pixDiscountCents ? <div className="flex justify-between"><dt className="text-ink-2">Desconto Pix</dt><dd className="font-bold">− {brl(t.pixDiscountCents)}</dd></div> : null}
      {showShipping ? (
        <div className="flex justify-between"><dt className="text-ink-2">Retirada no evento</dt><dd className="font-bold">Grátis</dd></div>
      ) : null}
      <div className="flex justify-between items-baseline pt-3 mt-1 border-t border-line"><dt className="font-bold text-base">Total</dt><dd className="text-2xl font-black tracking-tight">{brl(t.totalCents)}</dd></div>
      {quote.discount && !t.pixAllowed ? <p className="text-xs text-ink-3">Este desconto não soma com o desconto do Pix.</p> : null}
    </dl>
  );
}
