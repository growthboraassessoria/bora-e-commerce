"use client";
// Seletor de tamanho único (página de produto e pré-venda). O tamanho fica grande e centralizado;
// o estado vem curto embaixo ("Últimas", "Esgotado") e o escolhido ganha fundo preto e um ✓ verde.
import { CheckIcon } from "@/components/ui/Icons";
import { track } from "@/lib/analytics";

export type SizeOption = { id: string; size: string; stock: number };

export default function SizePicker({ sizes, value, onPick, low = 5, invalid = false, item }: { sizes: SizeOption[]; value: string | null; onPick: (id: string) => void; low?: number; invalid?: boolean; /** Peça, para o evento select_size. */ item?: { id: string; name: string } }) {
  return (
    <div role="radiogroup" aria-label="Tamanho" className="grid grid-cols-[repeat(auto-fit,minmax(48px,1fr))] gap-1.5 sm:gap-2 max-w-[560px]">
      {sizes.map((s) => {
        const sel = s.id === value;
        const out = s.stock <= 0;
        const few = !out && s.stock <= low;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-pressed={sel}
            disabled={out}
            onClick={() => { track("select_size", { item_id: item?.id, item_name: item?.name, variant_id: s.id, size: s.size }); onPick(s.id); }}
            aria-label={`${s.size}${out ? ", esgotado" : few ? ", últimas peças" : ""}`}
            className={`relative h-[68px] min-w-0 rounded-2xl grid place-items-center transition-all duration-200
              ${sel ? "bg-ink text-white shadow-[0_10px_24px_rgba(0,0,0,.18)]" : invalid ? "ring-2 ring-danger/60" : "ring-1 ring-line hover:ring-ink"}
              disabled:cursor-not-allowed disabled:bg-sand disabled:ring-0 disabled:text-ink-3`}
          >
            <span className={`text-lg font-black leading-none ${out ? "line-through decoration-2" : ""} ${few || out ? "-translate-y-1.5" : ""}`}>{s.size}</span>
            {sel ? <span className="absolute top-1.5 right-1.5 size-4 rounded-full bg-neon text-black grid place-items-center"><CheckIcon size={10} /></span> : null}
            {out || few ? (
              <span className={`absolute bottom-2 inset-x-1 text-center text-[9px] font-bold uppercase tracking-[0.04em] leading-none whitespace-nowrap ${out ? "text-ink-3" : sel ? "text-neon" : "text-danger"}`}>
                {out ? "Esgotado" : "Últimas"}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
