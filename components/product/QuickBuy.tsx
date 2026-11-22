"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cart } from "@/lib/cart";
import type { Product } from "@/lib/types";

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG", "34-38", "39-43", "U"];

// Compra compacta (cor + tamanho + botão) para a página de vendas.
export default function QuickBuy({ p, dark = false }: { p: Product; dark?: boolean }) {
  const router = useRouter();
  const colors = useMemo(() => [...new Map(p.variants.map((v) => [v.color, v.colorHex])).entries()], [p]);
  const [color, setColor] = useState(colors[0]?.[0] ?? "");
  const [size, setSize] = useState<string | null>(null);
  const [warn, setWarn] = useState(false);
  const sizes = p.variants.filter((v) => v.color === color).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  const variant = sizes.find((v) => v.size === size);
  const ring = dark ? "ring-white/25 hover:ring-white" : "ring-line hover:ring-ink";
  const on = dark ? "bg-white text-black" : "bg-ink text-white";
  return (
    <div className="grid gap-5">
      <div className="flex gap-2.5">
        {colors.map(([name, hex]) => (
          <button key={name} type="button" onClick={() => { setColor(name); setSize(null); }} className={`h-11 pl-1.5 pr-4 rounded-full flex items-center gap-2 text-sm font-bold ring-1 transition ${name === color ? (dark ? "ring-white" : "ring-ink ring-2") : ring}`}>
            <span className="size-8 rounded-full ring-1 ring-black/15" style={{ background: hex }} />{name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((v) => (
          <button key={v.id} type="button" disabled={v.stock <= 0} onClick={() => { setSize(v.size); setWarn(false); }} className={`h-11 min-w-12 px-3 rounded-xl text-sm font-bold ring-1 transition disabled:opacity-30 disabled:line-through ${v.size === size ? on + " ring-transparent" : ring}`}>{v.size}</button>
        ))}
      </div>
      {warn ? <p className={`text-sm font-bold ${dark ? "text-neon" : "text-danger"}`}>Escolha o tamanho da camiseta.</p> : null}
      <button
        type="button"
        className="btn btn-neon btn-lg btn-block"
        onClick={() => {
          if (!variant) return setWarn(true);
          cart.add(variant.id, 1, false, { itemId: p.id, name: p.name, size: variant.size, priceCents: variant.priceCents ?? p.priceCents });
          router.push("/checkout");
        }}
      >
        Garantir meu kit
      </button>
    </div>
  );
}
