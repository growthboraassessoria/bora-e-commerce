"use client";
import Image from "next/image";
import Link from "next/link";
import { cart } from "@/lib/cart";
import { brl } from "@/lib/money";
import type { PricedLine } from "@/lib/types";
import { MinusIcon, PlusIcon, TrashIcon } from "./Icons";

export default function LineItem({ line, compact = false, onNavigate }: { line: PricedLine; compact?: boolean; onNavigate?: () => void }) {
  const over = line.quantity > line.stock;
  const info = { itemId: line.productId, name: line.name, size: line.variantLabel.split(" · ").pop(), priceCents: line.unitCents };
  return (
    <div className="flex gap-4 py-4">
      <Link href={`/produto/${line.slug}`} onClick={onNavigate} className={`relative shrink-0 overflow-hidden rounded-2xl bg-sand ${compact ? "size-20" : "size-24 sm:size-28"}`}>
        <Image src={line.image} alt={line.name} fill sizes="112px" className="object-cover" />
      </Link>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/produto/${line.slug}`} onClick={onNavigate} className="font-bold leading-tight hover:underline underline-offset-4">{line.name}</Link>
            <p className="text-sm text-ink-3 mt-0.5 truncate">{line.variantLabel}</p>
          </div>
          <p className="font-bold whitespace-nowrap">{brl(line.unitCents * line.quantity)}</p>
        </div>
        {over ? <p className="text-xs font-bold text-danger mt-1">{line.stock <= 0 ? "Esgotado" : `Só restam ${line.stock}`}</p> : null}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="inline-flex items-center rounded-full bg-sand h-10">
            <button type="button" aria-label="Diminuir" className="pressable size-10 grid place-items-center rounded-full" onClick={() => cart.setQty(line.variantId, line.quantity - 1, info)}><MinusIcon size={16} /></button>
            <span className="w-6 text-center text-[15px] font-bold tabular-nums">{line.quantity}</span>
            <button type="button" aria-label="Aumentar" className="pressable size-10 grid place-items-center rounded-full disabled:opacity-30" disabled={line.quantity >= Math.min(10, line.stock)} onClick={() => cart.setQty(line.variantId, line.quantity + 1, info)}><PlusIcon size={16} /></button>
          </div>
          <button type="button" className="pressable text-ink-3 hover:text-ink size-11 -mr-2.5 grid place-items-center rounded-full" aria-label={`Remover ${line.name}`} onClick={() => cart.remove(line.variantId, info)}><TrashIcon size={18} /></button>
        </div>
      </div>
    </div>
  );
}
