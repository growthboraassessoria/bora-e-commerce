"use client";
// Pedido opcional de localização no checkout. O navegador só pergunta depois que o cliente toca aqui.
// Recusar (ou o aparelho não ter GPS) não muda nada na compra.
import { useState } from "react";
import type { GpsInput } from "@/lib/geo";

type State = "idle" | "asking" | "ok" | "denied" | "unavailable";

const PinIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" />
  </svg>
);

export default function LocationShare({ value, onChange, className = "" }: { value: GpsInput | null; onChange: (g: GpsInput | null) => void; className?: string }) {
  const [state, setState] = useState<State>(value ? "ok" : "idle");

  const ask = () => {
    if (value) { onChange(null); setState("idle"); return; } // segundo toque: deixa de compartilhar
    if (!("geolocation" in navigator)) { setState("unavailable"); return; }
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp || Date.now() });
        setState("ok");
      },
      (e) => setState(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 },
    );
  };

  const on = state === "ok" && !!value;
  const sub =
    state === "asking" ? "Aguardando a permissão do navegador…"
    : on ? `Localização compartilhada${value!.accuracy ? ` (precisão de ~${value!.accuracy < 1000 ? `${Math.round(value!.accuracy)} m` : `${(value!.accuracy / 1000).toFixed(1)} km`})` : ""}. Toque de novo para remover.`
    : state === "denied" ? "Sem problema: a compra segue normal sem a localização."
    : state === "unavailable" ? "Não deu para ler a localização deste aparelho. A compra segue normal."
    : "Opcional. Não muda nada na sua compra.";

  return (
    <button type="button" onClick={ask} disabled={state === "asking"} aria-pressed={on}
      className={`pressable w-full flex items-start gap-3 text-left text-sm rounded-2xl bg-white ring-1 ring-line p-4 lg:p-0 lg:bg-transparent lg:ring-0 focus-visible:ring-2 focus-visible:ring-ink ${className}`}>
      {/* Marcador redondo no jeito iOS, igual ao do aceite */}
      <span aria-hidden className={`mt-px size-6 shrink-0 rounded-full grid place-items-center transition-colors ${on ? "bg-neon text-black ring-1 ring-ink" : "ring-[1.5px] ring-line-strong text-ink-3"}`}>
        {state === "asking" ? <span className="size-3 rounded-full border-2 border-line-strong border-t-ink animate-spin" /> : <PinIcon size={14} />}
      </span>
      <span className="leading-relaxed">
        <span className="block text-ink">Compartilhar minha localização para a BORA entender de onde vêm os pedidos</span>
        <span className="block text-[13px] lg:text-xs text-ink-3" aria-live="polite">{sub}</span>
      </span>
    </button>
  );
}
