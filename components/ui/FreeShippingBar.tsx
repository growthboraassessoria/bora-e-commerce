import { STORE } from "@/lib/config";
import { brl } from "@/lib/money";

export default function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const left = Math.max(0, STORE.freeShippingCents - subtotal);
  const pct = Math.min(100, (subtotal / STORE.freeShippingCents) * 100);
  return (
    <div>
      <p className="text-sm">
        {left > 0 ? (<>Faltam <strong>{brl(left)}</strong> para o <strong>frete grátis</strong></>) : (<><strong>Frete grátis</strong> liberado no econômico 🏁</>)}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-sand-2 overflow-hidden">
        <div className="h-full rounded-full bg-neon transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%`, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
      </div>
    </div>
  );
}
