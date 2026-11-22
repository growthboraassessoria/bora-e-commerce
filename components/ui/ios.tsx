"use client";
// Peças de interface no jeito do iOS, usadas na versão de celular da loja:
// teclado aberto, folha que fecha arrastando, controle segmentado e o "toque" (estado pressionado).
import { useEffect, useRef, useState } from "react";

const TEXT_TYPES = new Set(["text", "email", "tel", "number", "search", "url", "password", ""]);
const isTextField = (el: Element | null) =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)) || (el instanceof HTMLElement && el.isContentEditable);

/**
 * Teclado do celular aberto (algum campo de texto em foco, em tela de toque).
 * Serve para esconder a barra de abas e as barras fixas de baixo, que no iOS ficariam por cima do teclado.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = (e: FocusEvent) => { if (isTextField(e.target as Element)) { clearTimeout(t); setOpen(true); } };
    // Espera um instante: ao pular de um campo para o outro, o teclado não chega a fechar.
    const off = () => { clearTimeout(t); t = setTimeout(() => setOpen(isTextField(document.activeElement)), 120); };
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => { clearTimeout(t); document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, []);
  return open;
}

/** Tela pequena (celular), para comportamentos que só fazem sentido lá. */
export function useIsPhone(max = 639.98) {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [max]);
  return phone;
}

/**
 * Arrastar para baixo para fechar uma folha (sheet). Liga os eventos na alça/cabeçalho da folha.
 * Passou de ~110 px (ou foi um puxão rápido) fecha; senão volta para o lugar.
 */
export function useSheetDrag(onClose: () => void, enabled = true) {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);
  const last = useRef(0);
  const end = () => {
    if (!start.current) return;
    const d = last.current;
    const speed = d / Math.max(1, Date.now() - start.current.t);
    start.current = null;
    setDragging(false);
    if (d > 110 || (d > 30 && speed > 0.6)) {
      onClose();
      // Some junto com a folha e depois zera (já fora da tela).
      setTimeout(() => { last.current = 0; setDy(0); }, 450);
    } else { last.current = 0; setDy(0); }
  };
  const handlers = enabled
    ? {
        onTouchStart: (e: React.TouchEvent) => { start.current = { y: e.touches[0].clientY, t: Date.now() }; last.current = 0; },
        onTouchMove: (e: React.TouchEvent) => {
          if (!start.current) return;
          const d = Math.max(0, e.touches[0].clientY - start.current.y);
          last.current = d;
          if (d > 2) setDragging(true);
          setDy(d);
        },
        onTouchEnd: end,
        onTouchCancel: end,
      }
    : {};
  return { handlers, style: dy ? ({ transform: `translateY(${dy}px)` } as React.CSSProperties) : undefined, dragging };
}

/**
 * Controle segmentado do iOS: trilho cinza com a opção escolhida em branco, deslizando.
 * Cada opção é um botão role="radio" (acessível e fácil de testar).
 */
export function Segmented<T extends string | boolean>({ value, onChange, options, label, className = "" }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  return (
    <div role="radiogroup" aria-label={label} className={`relative grid rounded-[14px] bg-sand-2/80 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {/* Indicador que desliza até a opção escolhida */}
      <span aria-hidden className="absolute top-1 bottom-1 left-1 rounded-[11px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-out-expo"
        style={{ width: `calc((100% - 8px) / ${n})`, transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`relative z-10 min-h-11 px-2 py-2 rounded-[11px] flex flex-col items-center justify-center text-center leading-tight transition-colors ${on ? "text-ink" : "text-ink-2 active:opacity-60"}`}>
            <span className="flex items-center gap-1.5 text-[15px] font-bold">{o.icon}{o.label}</span>
            {o.sub ? <span className={`mt-0.5 text-xs ${on ? "text-ink-2" : "text-ink-3"}`}>{o.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Seta do botão "voltar" do iOS. */
export const ChevronLeft = ({ size = 22, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M15 5l-7 7 7 7" /></svg>
);
export const ChevronRight = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M9 5l7 7-7 7" /></svg>
);

/**
 * No Safari do iPhone o estado :active (o "afundar" ao tocar) só funciona se a página escuta toques.
 * Este componente liga um ouvinte vazio, uma vez, para todas as telas.
 */
export function TouchActive() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}
