"use server";
import { isValidCpf } from "@/lib/cpf";
import { onlyDigits } from "@/lib/shipping";
import { findOrdersByCustomer, orderToken } from "@/lib/server/orders";
import { clientIp, hit, minDelay } from "@/lib/server/rate-limit";
import type { OrderStatus } from "@/lib/types";
import { customerSteps, currentStepLabel, type CustomerStep } from "@/lib/etapas";

export type MyOrder = {
  code: string;
  createdAt: string;
  status: OrderStatus;
  statusLabel: string;
  totalCents: number;
  paymentMethod: "pix" | "card";
  pickupBy: string;
  items: { name: string; size: string; quantity: number }[];
  passUrl: string;
  /** Andamento (mesmas etapas da linha de processo do BORA OS). */
  steps: CustomerStep[];
};

export type SearchResult = { ok: true; orders: MyOrder[] } | { ok: false; error: string };

const STATUS: Record<OrderStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago, a retirar",
  shipped: "Pago, a retirar",
  delivered: "Retirado",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

const sizeOf = (label: string) => {
  const s = label.split(" · ").pop() ?? label;
  return s === "Tamanho único" ? "Único" : s;
};

// Busca por CPF + celular (os dois precisam bater). Limite por IP e tempo mínimo de resposta;
// a mensagem é a mesma exista ou não o CPF, para não servir de consulta de cadastro.
export async function searchMyOrders(input: { cpf: string; phone: string }): Promise<SearchResult> {
  const started = Date.now();
  const cpf = onlyDigits(String(input?.cpf ?? "")).slice(0, 11);
  const phone = onlyDigits(String(input?.phone ?? "")).slice(0, 11);
  if (!hit(`pedidos:${await clientIp()}`, 10, 10 * 60_000)) {
    await minDelay(started, 800);
    return { ok: false, error: "Muitas buscas seguidas. Espere alguns minutos e tente de novo." };
  }
  if (!isValidCpf(cpf) || phone.length < 10) {
    await minDelay(started, 800);
    return { ok: false, error: "Confira o CPF e o celular (com DDD)." };
  }
  try {
    const orders = await findOrdersByCustomer(cpf, phone);
    await minDelay(started, 800);
    return {
      ok: true,
      orders: orders.map((o) => ({
        code: o.code, createdAt: o.createdAt, status: o.status, statusLabel: o.status === "paid" ? currentStepLabel(o) : STATUS[o.status] ?? o.status,
        steps: customerSteps(o),
        totalCents: o.totalCents, paymentMethod: o.paymentMethod, pickupBy: o.pickupName || o.name,
        items: o.items.map((it) => ({ name: it.name, size: sizeOf(it.variantLabel), quantity: it.quantity })),
        passUrl: `/obrigado/${o.id}?t=${orderToken(o.id)}`,
      })),
    };
  } catch (e) {
    console.error("meus-pedidos", e);
    await minDelay(started, 800);
    return { ok: false, error: "Não conseguimos buscar agora. Tente de novo em instantes." };
  }
}
