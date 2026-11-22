"use client";
import { useEffect } from "react";
import { CloseIcon } from "@/components/ui/Icons";
import { useSheetDrag } from "@/components/ui/ios";

// Medidas de referência (provisórias): confirmar com a ficha técnica do fornecedor.
const TABLES: Record<string, { head: string[]; rows: string[][]; note: string }> = {
  camisetas: { head: ["Tamanho", "Tórax (cm)", "Comprimento (cm)"], rows: [["PP", "48", "66"], ["P", "50", "69"], ["M", "53", "72"], ["G", "56", "74"], ["GG", "59", "76"], ["XGG", "62", "78"]], note: "Medidas da peça aberta, de axila a axila." },
  kits: { head: ["Tamanho", "Tórax (cm)", "Comprimento (cm)"], rows: [["PP", "48", "66"], ["P", "50", "69"], ["M", "53", "72"], ["G", "56", "74"], ["GG", "59", "76"], ["XGG", "62", "78"]], note: "Tamanho da camiseta do kit." },
  agasalhos: { head: ["Tamanho", "Tórax (cm)", "Comprimento (cm)", "Manga (cm)"], rows: [["P", "55", "70", "62"], ["M", "58", "72", "63"], ["G", "61", "74", "64"], ["GG", "64", "76", "65"], ["XGG", "67", "78", "66"]], note: "Corte regular: se estiver entre dois tamanhos, escolha o maior para usar com blusa por baixo." },
  regatas: { head: ["Tamanho", "Busto (cm)", "Comprimento (cm)"], rows: [["PP", "76-80", "38"], ["P", "80-86", "40"], ["M", "86-92", "42"], ["G", "92-98", "44"], ["GG", "98-104", "46"]], note: "Modelagem cropped e justa. Se gosta mais solta, escolha um tamanho acima." },
  triathlon: { head: ["Tamanho", "Altura (cm)", "Peso (kg)", "Tórax (cm)"], rows: [["P", "155-168", "50-62", "84-90"], ["M", "165-176", "60-72", "90-96"], ["G", "172-184", "70-82", "96-102"], ["GG", "180-192", "80-95", "102-110"]], note: "Modelagem justa, com compressão leve." },
  acessorios: { head: ["Tamanho", "Calçado"], rows: [["34-38", "34 a 38"], ["39-43", "39 a 43"], ["Boné", "Único, com regulagem"]], note: "" },
};

export default function SizeGuide({ category, onClose }: { category: string; onClose: () => void }) {
  const t = TABLES[category] ?? TABLES.camisetas;
  const drag = useSheetDrag(onClose);
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center bg-black/40 p-0 sm:p-6 animate-[fade-in_.25s_ease-out]" onClick={onClose} role="dialog" aria-label="Guia de medidas">
      {/* Celular: folha que sobe de baixo (arraste a alça para fechar). Desktop: janela no centro. */}
      <div style={drag.style} className={`bg-white w-full sm:max-w-lg max-h-[88svh] overflow-y-auto overscroll-contain rounded-t-[28px] sm:rounded-[28px] px-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:p-7 animate-sheet ${drag.dragging ? "" : "transition-transform duration-300"}`} onClick={(e) => e.stopPropagation()}>
        <div className="pt-2.5 sm:pt-0 touch-none sm:touch-auto" {...drag.handlers}>
          <span className="sheet-grabber sm:hidden" aria-hidden />
          <div className="mt-2 sm:mt-0 flex items-center justify-between">
            <p className="text-xl sm:text-2xl font-black uppercase tracking-tight">Guia de medidas</p>
            <button type="button" onClick={onClose} aria-label="Fechar" className="pressable size-11 -mr-2 grid place-items-center rounded-full bg-sand sm:bg-transparent hover:bg-sand"><CloseIcon size={20} /></button>
          </div>
        </div>
        <table className="mt-4 w-full text-[15px] sm:text-sm tabular-nums">
          <thead><tr>{t.head.map((h) => <th key={h} className="text-left py-2 border-b border-line text-ink-3 font-bold">{h}</th>)}</tr></thead>
          <tbody>{t.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`py-2.5 border-b border-line ${i === 0 ? "font-bold" : ""}`}>{c}</td>)}</tr>)}</tbody>
        </table>
        {t.note ? <p className="mt-4 text-sm text-ink-2">{t.note}</p> : null}
      </div>
    </div>
  );
}
