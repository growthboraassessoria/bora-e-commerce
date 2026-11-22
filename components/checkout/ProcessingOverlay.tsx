"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

// Tela de "processando" do pagamento: dura no mínimo 5 s (o checkout espera o pedido e o tempo mínimo juntos).
export const MIN_PROCESSING_MS = 5000;
const STEPS = ["Conferindo a grade da pré-venda", "Reservando a sua peça", "Preparando o pagamento seguro", "Tudo certo. letz BORA!"];

export default function ProcessingOverlay({ method }: { method: "pix" | "card" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(STEPS.length - 1, x + 1)), MIN_PROCESSING_MS / STEPS.length);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 z-[90] bg-[#070707] text-white grid place-items-center px-6 animate-[fade-in_.35s_ease-out]" role="status" aria-live="polite">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto w-[260px] h-[170px]">
          <svg viewBox="0 0 260 170" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <path id="volta" d="M40 85 C 40 30, 95 18, 130 30 S 225 25, 225 85 S 170 150, 130 140 S 40 140, 40 85 Z" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" strokeLinecap="round" />
            <path d="M40 85 C 40 30, 95 18, 130 30 S 225 25, 225 85 S 170 150, 130 140 S 40 140, 40 85 Z" fill="none" stroke="#ceff00" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" className="processing-draw" />
            <circle r="8" fill="#fff"><animateMotion dur={`${MIN_PROCESSING_MS / 1000}s`} repeatCount="1" fill="freeze"><mpath href="#volta" /></animateMotion></circle>
          </svg>
          <Image src="/img/marca/simbolo-white.png" alt="" width={60} height={76} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-auto opacity-90" />
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-white/50">{method === "pix" ? "Pagamento com Pix" : "Pagamento com cartão"}</p>
        <p key={i} className="mt-3 text-2xl font-black uppercase tracking-tight animate-rise">{STEPS[i]}</p>
        <div className="mt-8 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-neon rounded-full processing-bar" /></div>
        <p className="mt-4 text-sm text-white/50">Não feche esta página.</p>
      </div>
    </div>
  );
}
