"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// A cada troca de tela, o sticker letz BORAAA!! entra por cima por ~1 s. Não bloqueia cliques e respeita "reduzir movimento".
export default function RouteSticker() {
  const pathname = usePathname();
  // Compara com a tela anterior: no carregamento (e no modo estrito do React, que roda o efeito duas vezes) não dispara.
  const prev = useRef(pathname);
  const [key, setKey] = useState(0);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setKey((k) => k + 1);
    setOn(true);
    const t = setTimeout(() => setOn(false), 1000);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!on) return null;
  return (
    <div key={key} className="fixed inset-0 z-[100] pointer-events-none grid place-items-center overflow-hidden route-veil" aria-hidden="true">
      <div className="absolute inset-0 bg-[#070707]/80 backdrop-blur-[3px]" />
      <span className="absolute size-[42vmin] rounded-full border-[6px] border-neon route-ring" />
      <Image src="/img/marca/sticker-letz-bora-green.webp" alt="" width={520} height={360} priority className="relative w-[min(62vw,420px)] h-auto drop-shadow-[0_20px_50px_rgba(206,255,0,.35)] route-sticker" />
    </div>
  );
}
