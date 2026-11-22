"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { formatCpf, formatPhone, isValidCpf } from "@/lib/cpf";
import { onlyDigits } from "@/lib/shipping";
import { brl } from "@/lib/money";
import { track } from "@/lib/analytics";
import { ArrowIcon, LockIcon } from "@/components/ui/Icons";
import { searchMyOrders, type MyOrder } from "@/app/(loja)/meus-pedidos/actions";

const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const TONE: Record<MyOrder["status"], string> = {
  pending: "bg-sand text-ink-2",
  paid: "bg-neon text-black",
  shipped: "bg-neon text-black",
  delivered: "bg-ink text-white",
  canceled: "bg-danger/10 text-danger",
  refunded: "bg-sand text-ink-2",
};

export default function MyOrders() {
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidCpf(cpf)) return setError("CPF inválido.");
    const p = onlyDigits(phone);
    if (p.length < 10 || p.length > 11) return setError("Celular com DDD.");
    start(async () => {
      const res = await searchMyOrders({ cpf, phone }).catch(() => ({ ok: false as const, error: "Não conseguimos buscar agora. Tente de novo em instantes." }));
      if (!res.ok) {
        track("meus_pedidos_search", { result: "erro" });
        setOrders(null);
        setError(res.error);
        return;
      }
      track("meus_pedidos_search", { result: res.orders.length ? "encontrou" : "nada", count: res.orders.length });
      setOrders(res.orders);
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[400px_1fr] items-start">
      <form onSubmit={submit} noValidate className="card p-6 sm:p-7 shadow-[var(--shadow-card)] lg:sticky lg:top-[calc(var(--header-h)+16px)]">
        <div className="grid gap-4">
          <label className="field">
            <span>CPF de quem comprou</span>
            <input className="input" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} />
          </label>
          <label className="field">
            <span>Celular usado na compra</span>
            <input className="input" inputMode="tel" autoComplete="tel-national" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
          </label>
        </div>
        {error ? <p role="alert" className="mt-4 text-sm font-bold text-danger">{error}</p> : null}
        <button className="btn btn-primary btn-lg btn-block mt-5" disabled={pending}>{pending ? "Buscando…" : "Ver meus pedidos"}</button>
        <p className="mt-4 flex items-start gap-2 text-xs text-ink-3 leading-relaxed"><LockIcon size={14} className="shrink-0 mt-px" /> Mostramos só os pedidos em que o CPF e o celular batem. Ninguém vê seus dados por aqui.</p>
      </form>

      <div aria-live="polite">
        {orders === null ? (
          <div className="rounded-[28px] bg-sand p-8 sm:p-10">
            <p className="text-xl font-black uppercase tracking-tight">Seu passe fica aqui</p>
            <p className="mt-2 text-ink-2 max-w-md">Depois do pagamento aprovado, o passe de retirada com QR Code aparece no pedido. No evento, é só mostrar.</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[28px] bg-sand p-8 sm:p-10">
            <p className="text-xl font-black uppercase tracking-tight">Nenhum pedido encontrado</p>
            <p className="mt-2 text-ink-2 max-w-md">Não achamos pedidos com esse CPF e esse celular juntos. Confira se são os mesmos usados na compra.</p>
            <Link href="/colecao/todos" className="btn btn-ghost mt-6">Ver a loja</Link>
          </div>
        ) : (
          <ul className="grid gap-4">
            {orders.map((o) => (
              <li key={o.code} className="card p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold tracking-wider">{o.code}</p>
                    <p className="text-sm text-ink-3">{when(o.createdAt)} · {o.paymentMethod === "pix" ? "Pix" : "Cartão"}</p>
                  </div>
                  <span className={`chip ${TONE[o.status]}`}>{o.statusLabel}</span>
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-sand text-sm">
                      <span className="min-w-7 h-7 px-1.5 rounded-full bg-ink text-neon grid place-items-center text-[11px] font-black">{it.size}</span>
                      <span className="font-bold">{it.name}</span>
                      {it.quantity > 1 ? <span className="text-ink-3">×{it.quantity}</span> : null}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-end justify-between gap-4">
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <dt className="text-ink-3">Total</dt><dt className="text-ink-3">Quem retira</dt>
                    <dd className="font-black text-lg">{brl(o.totalCents)}</dd><dd className="font-bold truncate max-w-[14rem] self-center">{o.pickupBy}</dd>
                  </dl>
                  <Link href={o.passUrl} className={`btn ${o.status === "paid" || o.status === "shipped" ? "btn-primary" : "btn-ghost"}`}>Ver passe <ArrowIcon size={16} /></Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
