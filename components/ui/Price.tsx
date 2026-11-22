"use client";
import { brl } from "@/lib/money";
import { usePaymentRules } from "@/components/store/PaymentRulesProvider";
import { installmentsFor, pixBadge } from "@/lib/payment-rules";

export default function Price({ cents, compareAt, size = "md", showInstallments = false }: { cents: number; compareAt?: number | null; size?: "sm" | "md" | "lg"; showInstallments?: boolean }) {
  const cls = size === "lg" ? "text-3xl font-black tracking-tight" : size === "sm" ? "text-sm font-bold" : "text-base font-bold";
  const rules = usePaymentRules();
  const inst = rules.cardEnabled ? installmentsFor(cents, rules) : { n: 1, each: cents };
  const pix = pixBadge(rules);
  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cls}>{brl(cents)}</span>
        {compareAt ? <span className="text-sm text-ink-3 line-through">{brl(compareAt)}</span> : null}
      </div>
      {showInstallments && (inst.n > 1 || pix) ? (
        <p className="text-sm text-ink-2 mt-1">
          {inst.n > 1 ? <>ou {inst.n}x de {brl(inst.each)} sem juros</> : null}{inst.n > 1 && pix ? " · " : null}{pix ? <span className="font-bold text-ink">{pix}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
