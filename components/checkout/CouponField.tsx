"use client";
import { useEffect, useRef, useState } from "react";
import { cart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import type { Quote } from "@/lib/useQuote";

export default function CouponField({ quote, code }: { quote: Quote | null; code: string }) {
  const [value, setValue] = useState(code);
  const [open, setOpen] = useState(!!code);
  // Código que a pessoa acabou de aplicar: quando a resposta chegar, vira o evento apply_coupon.
  const asked = useRef<string | null>(null);
  const status = quote?.coupon;
  const auto = quote?.discount?.automatic ? quote.discount : null;

  useEffect(() => {
    setValue(code);
    if (code) setOpen(true);
  }, [code]);
  useEffect(() => {
    if (!asked.current || !status || status.code !== asked.current) return;
    track("apply_coupon", { code: status.code, result: status.applied ? "sucesso" : "erro", message: status.applied ? undefined : status.message ?? undefined });
    asked.current = null;
  }, [status]);

  const remove = () => {
    if (code) track("remove_coupon", { code });
    cart.setCoupon("");
    setValue("");
  };

  return (
    <div className="grid gap-2">
      {auto ? (
        <p className="text-sm font-bold text-neon-deep">Desconto automático: {auto.title} ✓</p>
      ) : null}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="justify-self-start min-h-11 text-[15px] lg:text-sm font-bold underline underline-offset-4">Tem um cupom?</button>
      ) : (
        <div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = value.trim().toUpperCase(); if (!c) return; asked.current = c; cart.setCoupon(c); }}>
            <label className="flex-1"><span className="sr-only">Cupom</span><input value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder="Cupom de desconto" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="done" className="input uppercase" aria-invalid={status && code ? !status.ok : undefined} /></label>
            <button className="btn btn-ghost h-[50px]">Aplicar</button>
          </form>
          {status && code ? (
            <p className={`mt-2 text-sm font-bold ${status.applied ? "text-neon-deep" : status.ok ? "opacity-75" : "text-danger"}`}>
              {status.applied ? `Cupom ${status.code} aplicado ✓` : status.message}
              {" "}<button type="button" className="underline font-normal text-ink-3 px-1 py-2" onClick={remove}>remover</button>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
