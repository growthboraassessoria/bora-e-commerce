"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

export default function Newsletter({ dark = false }: { dark?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  return (
    <form
      className="flex gap-2 w-full max-w-md"
      data-track-form="newsletter"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        const email = String(new FormData(e.currentTarget).get("email") || "");
        const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        setState(res.ok ? "ok" : "error");
        if (res.ok) track("generate_lead", { method: "newsletter" });
      }}
    >
      {state === "ok" ? (
        <p className={`h-[52px] flex items-center font-bold ${dark ? "text-neon" : ""}`}>Pronto. Você vai saber dos próximos drops primeiro. ⚡</p>
      ) : (
        <>
          <label className="flex-1">
            <span className="sr-only">Seu e-mail</span>
            <input name="email" type="email" required placeholder="Seu melhor e-mail" className={`input rounded-full h-[52px] ${dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/50" : ""}`} aria-invalid={state === "error"} />
          </label>
          <button className="btn btn-neon" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Quero"}</button>
        </>
      )}
    </form>
  );
}
