"use client";
import { useEffect } from "react";
import { CloseIcon } from "@/components/ui/Icons";

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
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center bg-black/40 p-0 sm:p-6" onClick={onClose} role="dialog" aria-label="Guia de medidas">
      <div className="bg-white w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] p-7 animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-black uppercase tracking-tight">Guia de medidas</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="size-10 grid place-items-center rounded-full hover:bg-sand"><CloseIcon /></button>
        </div>
        <table className="mt-5 w-full text-sm">
          <thead><tr>{t.head.map((h) => <th key={h} className="text-left py-2 border-b border-line text-ink-3 font-bold">{h}</th>)}</tr></thead>
          <tbody>{t.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`py-2.5 border-b border-line ${i === 0 ? "font-bold" : ""}`}>{c}</td>)}</tr>)}</tbody>
        </table>
        {t.note ? <p className="mt-4 text-sm text-ink-2">{t.note}</p> : null}
      </div>
    </div>
  );
}
