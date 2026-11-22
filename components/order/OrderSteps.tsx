// Andamento do pedido para o cliente: as mesmas etapas da linha de processo do BORA OS (lib/etapas.ts).
// "full": página de obrigado (vertical no celular, em linha a partir do sm). "compact": barra fina de Meus pedidos.
import { CheckIcon } from "@/components/ui/Icons";
import type { CustomerStep } from "@/lib/etapas";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null);

export default function OrderSteps({ steps, hints = {}, variant = "full", className = "" }: { steps: CustomerStep[]; hints?: Record<string, string | null | undefined>; variant?: "full" | "compact"; className?: string }) {
  if (variant === "compact") {
    const now = steps.find((s) => s.current) ?? steps[steps.length - 1];
    const doneN = steps.filter((s) => s.done).length;
    return (
      <div className={className}>
        <div className="flex gap-1" aria-hidden>
          {steps.map((s) => <span key={s.id} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-ink" : s.current ? "bg-neon" : "bg-sand-2"}`} />)}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          <span className="sr-only">Andamento: </span>
          {doneN === steps.length ? <strong className="text-ink">{steps[steps.length - 1].label}</strong> : <>Próxima etapa: <strong className="text-ink">{now.label}</strong></>}
          <span> · {doneN} de {steps.length}</span>
        </p>
      </div>
    );
  }
  return (
    <ol className={`grid gap-0 sm:grid-cols-6 sm:gap-2 ${className}`} aria-label="Andamento do pedido">
      {steps.map((s, i) => {
        const d = s.done ? time(s.at) ?? (i === 0 ? null : "Concluído") : hints[s.id] ?? null;
        const next = steps[i + 1];
        return (
          <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0 sm:block sm:pb-0">
            {next ? <span className={`absolute left-[13px] top-7 bottom-0 w-0.5 sm:left-7 sm:right-0 sm:top-[13px] sm:bottom-auto sm:h-0.5 sm:w-auto rounded ${next.done ? "bg-ink" : "bg-sand-2"}`} /> : null}
            <span className={`relative z-10 size-7 shrink-0 rounded-full grid place-items-center text-xs font-black ${s.done ? "bg-ink text-neon" : s.current ? "bg-white ring-2 ring-ink text-ink" : "bg-sand text-ink-3"}`}>
              {s.done ? <CheckIcon size={14} /> : i + 1}
            </span>
            <div className="min-w-0 pt-1 sm:pt-0">
              <p className={`sm:mt-3 text-[13px] font-bold leading-tight pr-2 hyphens-auto [overflow-wrap:anywhere] ${s.done || s.current ? "" : "text-ink-3"}`}>{s.label}</p>
              {d ? <p className="mt-0.5 text-xs text-ink-3 leading-snug pr-2">{d}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
