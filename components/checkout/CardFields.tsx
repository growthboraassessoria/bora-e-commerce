"use client";
// Cartão no checkout transparente (Pagar.me): dados do cartão, parcelas e endereço de cobrança.
// O número do cartão nunca vai para o servidor da BORA: vira token direto na Pagar.me ao pagar.
import { useEffect, useState } from "react";
import { brl } from "@/lib/money";
import { BRAND_LABEL, cardBrand, formatCardNumber, formatExp } from "@/lib/pagarme-client";
import { CheckIcon, LockIcon } from "@/components/ui/Icons";

export type CardState = { cardNumber: string; cardHolder: string; cardExp: string; cardCvv: string; installments: number };
export type BillingState = { zip: string; street: string; number: string; complement: string; district: string; city: string; uf: string };
export const EMPTY_CARD: CardState = { cardNumber: "", cardHolder: "", cardExp: "", cardCvv: "", installments: 1 };
export const EMPTY_BILLING: BillingState = { zip: "", street: "", number: "", complement: "", district: "", city: "", uf: "" };

export function billingErrors(b: BillingState) {
  const e: Record<string, string> = {};
  if (b.zip.replace(/\D/g, "").length !== 8) e.zip = "CEP com 8 dígitos";
  if (b.street.trim().length < 2) e.street = "Rua";
  if (!b.number.trim()) e.number = "Número";
  if (!b.district.trim()) e.district = "Bairro";
  if (b.city.trim().length < 2) e.city = "Cidade";
  if (b.uf.trim().length !== 2) e.uf = "UF";
  return e;
}

function F({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`field ${className}`}>
      <span className="flex items-center justify-between gap-2">{label}{error ? <span className="text-xs font-bold text-danger">{error}</span> : null}</span>
      {children}
    </label>
  );
}

export default function CardFields({ card, setCard, billing, setBilling, errors, total, maxInstallments, simulated = false }: {
  simulated?: boolean;
  card: CardState; setCard: (f: (c: CardState) => CardState) => void;
  billing: BillingState; setBilling: (f: (b: BillingState) => BillingState) => void;
  errors: Record<string, string>; total: number; maxInstallments: number;
}) {
  const brand = cardBrand(card.cardNumber);
  const [cepState, setCepState] = useState<"idle" | "loading" | "error">("idle");
  const zip = billing.zip.replace(/\D/g, "");

  // CEP completo: preenche rua, bairro, cidade e UF.
  useEffect(() => {
    if (zip.length !== 8) return;
    let off = false;
    setCepState("loading");
    fetch(`/api/cep?cep=${zip}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d: { street: string; district: string; city: string; uf: string }) => {
      if (off) return;
      setBilling((b) => ({ ...b, street: b.street || d.street, district: b.district || d.district, city: d.city, uf: d.uf }));
      setCepState("idle");
    }).catch(() => !off && setCepState("error"));
    return () => { off = true; };
  }, [zip, setBilling]);

  const setC = (k: keyof CardState, fmt?: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = fmt ? fmt(e.target.value) : e.target.value;
    setCard((c) => ({ ...c, [k]: v }));
  };
  const setB = (k: keyof BillingState, fmt?: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = fmt ? fmt(e.target.value) : e.target.value;
    setBilling((b) => ({ ...b, [k]: v }));
  };

  return (
    <div className="grid gap-5">
      <div className="ios-group grid grid-cols-6 gap-3">
        <F label="Número do cartão" error={errors.cardNumber} className="col-span-6">
          <div className="relative">
            <input className="input pr-28 tabular-nums" inputMode="numeric" autoComplete="cc-number" enterKeyHint="next" placeholder="0000 0000 0000 0000" value={card.cardNumber} onChange={setC("cardNumber", formatCardNumber)} aria-invalid={!!errors.cardNumber} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wider text-ink-3">{brand ? BRAND_LABEL[brand] : ""}</span>
          </div>
        </F>
        <F label="Nome impresso no cartão" error={errors.cardHolder} className="col-span-6">
          <input className="input uppercase" autoComplete="cc-name" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="next" value={card.cardHolder} onChange={setC("cardHolder")} aria-invalid={!!errors.cardHolder} />
        </F>
        <F label="Validade" error={errors.cardExp} className="col-span-3">
          <input className="input tabular-nums" inputMode="numeric" autoComplete="cc-exp" enterKeyHint="next" placeholder="MM/AA" value={card.cardExp} onChange={setC("cardExp", formatExp)} aria-invalid={!!errors.cardExp} />
        </F>
        <F label="CVV" error={errors.cardCvv} className="col-span-3">
          <input className="input tabular-nums" inputMode="numeric" autoComplete="cc-csc" enterKeyHint="next" placeholder={brand === "amex" ? "0000" : "000"} value={card.cardCvv} onChange={setC("cardCvv", (v) => v.replace(/\D/g, "").slice(0, 4))} aria-invalid={!!errors.cardCvv} />
        </F>
      </div>

      {/* Parcelas: lista com marcação, como um seletor do iOS */}
      <div>
        <p className="text-sm font-bold px-1 sm:px-0">Parcelas</p>
        <div className="mt-2 rounded-2xl bg-white ring-1 ring-line overflow-hidden divide-y divide-line sm:grid sm:grid-cols-3 sm:gap-2 sm:divide-y-0 sm:bg-transparent sm:ring-0 sm:rounded-none" role="radiogroup" aria-label="Parcelas">
          {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => {
            const on = card.installments === n;
            return (
              <button key={n} type="button" role="radio" aria-checked={on} onClick={() => setCard((c) => ({ ...c, installments: n }))}
                className={`row-press w-full flex items-center gap-3 min-h-[52px] px-4 text-left text-[15px] sm:min-h-0 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm transition ${on ? "sm:bg-ink sm:text-white" : "sm:bg-white sm:ring-1 sm:ring-line sm:hover:ring-ink/40"}`}>
                <span className="flex-1"><strong>{n}x</strong> {brl(Math.ceil(total / n))}<span className="sm:hidden text-ink-3"> · sem juros</span></span>
                <span aria-hidden className={`sm:hidden size-6 rounded-full grid place-items-center ${on ? "bg-neon ring-1 ring-ink" : ""}`}>{on ? <CheckIcon size={14} /> : null}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 px-1 sm:px-0 text-[13px] sm:text-xs text-ink-3">Sem juros.</p>
      </div>

      <div>
        <p className="text-sm font-bold px-1 sm:px-0">Endereço de cobrança do cartão</p>
        <p className="px-1 sm:px-0 text-[13px] sm:text-xs text-ink-3 leading-snug">Pedido pela operadora para aprovar a compra. Não é endereço de entrega: a retirada é no evento.</p>
        <div className="ios-group mt-3 grid grid-cols-6 gap-3">
          <F label="CEP" error={errors.zip || (cepState === "error" ? "CEP não encontrado" : undefined)} className="col-span-3 sm:col-span-2">
            <input className="input tabular-nums" inputMode="numeric" autoComplete="billing postal-code" enterKeyHint="next" placeholder="00000-000" value={billing.zip} onChange={setB("zip", (v) => v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"))} aria-invalid={!!errors.zip} />
          </F>
          <F label="Número" error={errors.number} className="col-span-3 sm:col-span-1">
            <input className="input" inputMode="numeric" autoComplete="off" enterKeyHint="next" value={billing.number} onChange={setB("number")} aria-invalid={!!errors.number} />
          </F>
          <F label="Complemento" className="col-span-6 sm:col-span-3">
            <input className="input" autoComplete="billing address-line2" enterKeyHint="next" value={billing.complement} onChange={setB("complement")} placeholder="Opcional" />
          </F>
          <F label="Rua" error={errors.street} className="col-span-6 sm:col-span-4">
            <input className="input" autoComplete="billing address-line1" enterKeyHint="next" value={billing.street} onChange={setB("street")} aria-invalid={!!errors.street} placeholder={cepState === "loading" ? "Buscando…" : ""} />
          </F>
          <F label="Bairro" error={errors.district} className="col-span-6 sm:col-span-2">
            <input className="input" enterKeyHint="next" value={billing.district} onChange={setB("district")} aria-invalid={!!errors.district} />
          </F>
          <F label="Cidade" error={errors.city} className="col-span-4">
            <input className="input" autoComplete="billing address-level2" enterKeyHint="next" value={billing.city} onChange={setB("city")} aria-invalid={!!errors.city} />
          </F>
          <F label="UF" error={errors.uf} className="col-span-2">
            <input className="input uppercase" maxLength={2} autoCapitalize="characters" enterKeyHint="done" autoComplete="billing address-level1" value={billing.uf} onChange={setB("uf", (v) => v.toUpperCase().slice(0, 2))} aria-invalid={!!errors.uf} />
          </F>
        </div>
      </div>

      {simulated ? <p className="rounded-xl bg-neon/40 px-3 py-2.5 text-[13px] sm:text-xs leading-snug"><strong>Demonstração:</strong> nada é cobrado. Use um cartão de teste, por exemplo 4000 0000 0000 0010, validade futura e CVV 123.</p> : null}
      <p className="flex items-start gap-2 px-1 sm:px-0 text-[13px] sm:text-xs text-ink-3 leading-snug"><LockIcon size={14} className="shrink-0 mt-0.5" /> Os dados do cartão vão direto para a Pagar.me, criptografados. A BORA não vê nem guarda o número do cartão.</p>
    </div>
  );
}
