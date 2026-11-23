"use client";
// Oferta "leve junto" (order bump) na sacola e no checkout: um toque adiciona o extra ao pedido, outro tira.
// Os dados vêm do orçamento do servidor (quote.extras); preço e estoque são sempre do banco.
import Image from "next/image";
import { useEffect, useRef } from "react";
import { cart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import { brl } from "@/lib/money";
import { offPct, type ExtraOffer as Offer } from "@/lib/extras";
import { CheckIcon, PlusIcon } from "./Icons";

export default function ExtraOffer({ offer: o, dark = false, location, className = "" }: { offer: Offer; dark?: boolean; location: string; className?: string }) {
  const pct = offPct(o);
  const each = o.units ? Math.round(o.priceCents / o.units) : null;
  const info = { itemId: o.productId, name: o.name, size: "Pack", priceCents: o.priceCents };

  // view_promotion: uma vez por oferta e por lugar, para medir quantos viram e quantos aceitaram.
  const seen = useRef(false);
  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    track("view_promotion", { promotion_id: `extra-${o.slug}`, promotion_name: "Leve junto", creative_slot: location, items: [{ item_id: o.productId, item_name: o.name, price: o.priceCents / 100 }] });
  }, [o.slug, o.productId, o.name, o.priceCents, location]);

  const toggle = () => {
    if (o.inCart) cart.remove(o.variantId, info);
    else {
      track("select_promotion", { promotion_id: `extra-${o.slug}`, promotion_name: "Leve junto", creative_slot: location, items: [{ item_id: o.productId, item_name: o.name, price: o.priceCents / 100 }] });
      cart.add(o.variantId, 1, false, info);
    }
  };

  const c = dark
    ? { box: o.inCart ? "bg-neon/10 ring-neon" : "bg-white/[0.06] ring-white/15", tile: "bg-white", mute: "text-white/60", strong: "text-white", tag: "bg-neon text-black", btn: o.inCart ? "bg-neon text-black" : "bg-white text-black", link: "text-white/70" }
    : { box: o.inCart ? "bg-neon/15 ring-ink" : "bg-white ring-line-strong", tile: "bg-sand", mute: "text-ink-3", strong: "text-ink", tag: "bg-neon text-black", btn: o.inCart ? "bg-ink text-white" : "bg-neon text-black", link: "text-ink-2" };

  return (
    <div className={`rounded-2xl ring-1 p-3 sm:p-4 transition-colors ${c.box} ${className}`}>
      <div className="flex gap-3 items-start">
        <div className={`relative size-[72px] sm:size-20 shrink-0 rounded-xl overflow-hidden ${c.tile}`}>
          <Image src={o.image} alt="" fill sizes="80px" className="object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${c.tag}`}>Leve junto{pct ? ` · ${pct}% off` : ""}</span>
          </div>
          <p className={`mt-1 text-[15px] font-black leading-tight ${c.strong}`}>
            + {brl(o.priceCents)} e leve o {o.name.split(/ [·-] /)[0]}
          </p>
          <p className={`mt-0.5 text-[13px] leading-snug ${c.mute}`}>
            {o.subtitle}
            {each ? <> · <strong className={c.strong}>{brl(each)} cada</strong></> : null}
            {o.compareAtCents && o.compareAtCents > o.priceCents ? <> · <span className="line-through">{brl(o.compareAtCents)}</span></> : null}
          </p>
          <p className={`mt-0.5 text-[13px] leading-snug ${c.mute}`}>Retira junto com o seu pedido na Pampulha.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={o.inCart}
        className={`pressable mt-3 w-full h-11 rounded-full text-[15px] font-black inline-flex items-center justify-center gap-2 ${c.btn}`}
      >
        {o.inCart ? <><CheckIcon size={18} /> Adicionado ao pedido</> : <><PlusIcon size={18} /> Adicionar por {brl(o.priceCents)}</>}
      </button>
      {o.inCart ? (
        <button type="button" onClick={toggle} className={`pressable mt-1 w-full h-9 text-[13px] underline underline-offset-4 ${c.link}`}>Remover do pedido</button>
      ) : null}
    </div>
  );
}
