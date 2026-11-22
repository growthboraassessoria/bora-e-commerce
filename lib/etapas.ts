// Etapas do pedido para o cliente (página de obrigado e Meus pedidos). Mesmos nomes da linha de processo do BORA OS
// (BORA OS/lib/loja/etapas.ts), que marca as etapas; o banco guarda as datas (migration 0005_loja_etapas.sql).
// Etapa que a equipe pulou aparece como concluída, sem data (o cliente não precisa ver "pulou").
import type { Order } from "./types";

export type CustomerStep = { id: string; label: string; at: string | null; done: boolean; current: boolean };

type StepInput = Pick<Order, "status" | "createdAt" | "paidAt" | "shippingMethod" | "pickedUpAt" | "processingAt" | "packedAt" | "shippedAt">;

export function customerSteps(o: StepInput): CustomerStep[] {
  const ship = !!o.shippingMethod && o.shippingMethod !== "retirada";
  const raw: { id: string; label: string; at: string | null }[] = [
    { id: "recebido", label: "Pedido recebido", at: o.createdAt },
    { id: "pagamento", label: o.paidAt ? "Pagamento aprovado" : "Pagamento", at: o.paidAt },
    { id: "processamento", label: "Em processamento", at: o.processingAt ?? null },
    { id: "separado", label: "Separado", at: o.packedAt ?? null },
    { id: "pronto", label: ship ? "Enviado" : "Pronto para retirada", at: o.shippedAt ?? null },
    { id: "retirado", label: ship ? "Entregue" : "Retirado", at: o.status === "delivered" ? o.pickedUpAt ?? null : null },
  ];
  // Até onde o pedido chegou: a maior etapa com data (entregue conta mesmo sem as do meio).
  let reached = 0;
  if (o.status === "delivered") reached = 5;
  else raw.forEach((s, i) => { if (s.at) reached = i; });
  // Atual = a primeira que ainda falta (é a que o cliente está esperando).
  return raw.map((s, i) => ({ ...s, done: i <= reached, current: i === reached + 1 }));
}

/** Nome curto da etapa em que o pedido está (para a lista de Meus pedidos). */
export function currentStepLabel(o: StepInput & Pick<Order, "status">): string {
  if (o.status === "canceled") return "Cancelado";
  if (o.status === "refunded") return "Reembolsado";
  if (o.status === "pending") return "Aguardando pagamento";
  const done = customerSteps(o).filter((s) => s.done);
  return done[done.length - 1]?.label ?? "Pedido recebido";
}
