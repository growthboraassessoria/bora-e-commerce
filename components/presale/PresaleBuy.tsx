"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cart } from "@/lib/cart";
import { brl } from "@/lib/money";
import { SALES_OPEN } from "@/lib/config";
import { usePaymentRules } from "@/components/store/PaymentRulesProvider";
import { installmentsFor, pixBadge, pixPct } from "@/lib/payment-rules";
import SoonCTA from "@/components/ui/SoonCTA";
import { CheckIcon, MinusIcon, PlusIcon } from "@/components/ui/Icons";
import SizePicker from "@/components/product/SizePicker";

export type BuySize = { id: string; size: string; stock: number };

// Escolha de tamanho da pré-venda. Não mostra quantidades: só avisa "últimas peças" e "esgotado".
export default function PresaleBuy({ name, priceCents, sizes, open = true, productId }: { name: string; priceCents: number; sizes: BuySize[]; open?: boolean; productId?: string }) {
  const router = useRouter();
  const [pick, setPick] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [warn, setWarn] = useState(false);
  const [added, setAdded] = useState(false);
  const v = sizes.find((s) => s.id === pick);
  const soldOut = !open || sizes.every((s) => s.stock <= 0);
  const rules = usePaymentRules();
  const inst = rules.cardEnabled ? installmentsFor(priceCents, rules) : { n: 1, each: priceCents };
  const pixText = pixBadge(rules);

  const add = (go: boolean) => {
    if (!v) return setWarn(true);
    cart.add(v.id, qty, !go, { itemId: productId ?? name, name, size: v.size, priceCents });
    if (go) router.push("/checkout");
    else { setAdded(true); setTimeout(() => setAdded(false), 1600); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-4xl font-black tracking-tight">{brl(priceCents)}</p>
        <p className="text-sm text-ink-2">{inst.n > 1 ? <>{inst.n}x de {brl(inst.each)}{pixText ? " · " : null}</> : null}{pixText ? <strong className="text-ink">{pixText}</strong> : null}</p>
      </div>
      <p className={`mt-6 text-sm font-bold ${warn && !v ? "text-danger" : ""}`}>{warn && !v ? "Escolha o tamanho" : "Tamanho"}</p>
      <div className="mt-3">
        <SizePicker item={{ id: productId ?? name, name }} sizes={sizes} value={pick} invalid={warn && !v} onPick={(id) => { setPick(id); setWarn(false); setQty(1); }} />
      </div>
      {!SALES_OPEN ? (
        <div className="mt-5">
          <SoonCTA className="w-full" message={`Oi! Quero garantir a ${name}${v ? ` tamanho ${v.size}` : ""} na pré-venda Volta 18K. Me avisa quando abrir?`} />
          <p className="mt-3 text-sm text-ink-2">Escolha o tamanho e chame a gente: quando a pré-venda abrir, você é o primeiro a saber.</p>
        </div>
      ) : (<>
      <div className="mt-5 flex gap-3">
        <div className="inline-flex items-center rounded-full ring-1 ring-line h-[60px] shrink-0">
          <button type="button" aria-label="Diminuir" className="w-10 sm:w-11 h-full grid place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))}><MinusIcon size={18} /></button>
          <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
          <button type="button" aria-label="Aumentar" className="w-10 sm:w-11 h-full grid place-items-center" onClick={() => setQty((q) => Math.min(Math.min(5, v?.stock ?? 5), q + 1))}><PlusIcon size={18} /></button>
        </div>
        <button type="button" disabled={soldOut} onClick={() => add(true)} className="btn btn-neon btn-lg flex-1 min-w-0 !px-5">{!open ? "Pré-venda encerrada" : soldOut ? "Esgotado" : <><span className="max-[369px]:hidden">Garantir na pré-venda</span><span className="min-[370px]:hidden">Garantir a minha</span></>}</button>
      </div>
      <button type="button" disabled={soldOut} onClick={() => add(false)} className="mt-1 min-h-11 text-sm font-bold underline underline-offset-4 inline-flex items-center gap-1.5 text-left">
        {added ? (<><CheckIcon size={14} /> {name} na sacola</>) : "Adicionar à sacola e continuar escolhendo"}
      </button>
      </>)}
    </div>
  );
}
