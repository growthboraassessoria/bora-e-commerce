"use client";
import { cart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import { PlusIcon } from "./Icons";

// Compra rápida no card: escolhe o tamanho da primeira cor sem abrir a página do produto.
export default function QuickAdd({ sizes, single, item }: { sizes: { id: string; size: string; stock: number }[]; single: boolean; item?: { id: string; name: string; priceCents: number } }) {
  const add = (s: { id: string; size: string }) => {
    const price = item ? item.priceCents / 100 : undefined;
    track("select_item", { item_id: item?.id, item_name: item?.name, price, currency: "BRL", location: "compra_rapida", items: [{ item_id: item?.id, item_name: item?.name, item_variant: s.size, price, quantity: 1 }] });
    cart.add(s.id, 1, true, item ? { itemId: item.id, name: item.name, size: s.size, priceCents: item.priceCents } : undefined);
  };
  if (single) {
    return (
      <button type="button" onClick={() => add(sizes[0])} className="absolute right-3 bottom-3 size-11 rounded-full bg-white shadow-lg grid place-items-center opacity-100 lg:opacity-0 lg:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-neon" aria-label="Adicionar à sacola">
        <PlusIcon />
      </button>
    );
  }
  return (
    <div className="hidden lg:block absolute inset-x-3 bottom-3 rounded-2xl bg-white/90 backdrop-blur-md p-3 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3 mb-2">Compra rápida</p>
      <div className="flex flex-wrap gap-1.5">
        {sizes.map((s) => (
          <button key={s.id} type="button" disabled={s.stock <= 0} onClick={() => add(s)} className="h-9 min-w-10 px-2 rounded-full ring-1 ring-line text-sm font-bold hover:bg-ink hover:text-white disabled:opacity-30 disabled:line-through transition-colors">
            {s.size}
          </button>
        ))}
      </div>
    </div>
  );
}
