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
            <p className="text-sm text-ink-3 mt-0.5">{line.variantLabel}</p>
          </div>
          <p className="font-bold whitespace-nowrap">{brl(line.unitCents * line.quantity)}</p>
        </div>
        {over ? <p className="text-xs font-bold text-danger mt-1">{line.stock <= 0 ? "Esgotado" : `Só restam ${line.stock}`}</p> : null}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="inline-flex items-center rounded-full ring-1 ring-line h-9">
            <button type="button" aria-label="Diminuir" className="size-9 grid place-items-center" onClick={() => cart.setQty(line.variantId, line.quantity - 1, info)}><MinusIcon size={16} /></button>
            <span className="w-6 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
            <button type="button" aria-label="Aumentar" className="size-9 grid place-items-center disabled:opacity-30" disabled={line.quantity >= Math.min(10, line.stock)} onClick={() => cart.setQty(line.variantId, line.quantity + 1, info)}><PlusIcon size={16} /></button>
          </div>
          <button type="button" className="text-ink-3 hover:text-ink p-2" aria-label={`Remover ${line.name}`} onClick={() => cart.remove(line.variantId, info)}><TrashIcon size={18} /></button>
        </div>
      </div>
    </div>
  );
}
