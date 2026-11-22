"use client";
import { useEffect, useState } from "react";
import { isOff, setOptOut } from "@/lib/analytics-client";

/** Botão do aviso de privacidade: desliga ou religa a medição de navegação neste navegador. */
export default function OptOut() {
  const [off, setOff] = useState<boolean | null>(null);
  useEffect(() => {
    let v = false;
    try { v = localStorage.getItem("bora-no-track") === "1"; } catch { v = isOff(); }
    setOff(v);
  }, []);
  if (off === null) return null;
  return (
    <p>
      <button
        type="button"
        data-no-track
        className="btn btn-ghost h-11 px-5 text-sm"
        onClick={() => { setOptOut(!off); setOff(!off); }}
      >
        {off ? "Religar a medição neste navegador" : "Desligar a medição neste navegador"}
      </button>
      <span className="block mt-2 text-sm text-ink-3">{off ? "Medição desligada neste navegador." : "Medição ligada neste navegador."}</span>
    </p>
  );
}
