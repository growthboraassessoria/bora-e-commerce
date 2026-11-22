"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copiar código Pix" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn btn-primary btn-block" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch {} }}>
      {ok ? "Copiado ✓" : label}
    </button>
  );
}
