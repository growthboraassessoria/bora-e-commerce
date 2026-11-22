import "server-only";
// Pagar.me (API v5, checkout transparente). Gateway de pagamento da BORA.
// - A chave secreta (PAGARME_SECRET_KEY) só existe no servidor; a pública só gera o token do cartão no navegador.
// - Cartão: token do navegador → cartão salvo no cliente (card_id) → pedido. Funciona em conta Gateway e PSP.
// - Pix: pedido com QR (copia e cola + imagem), vence junto com a reserva das peças.
// - Docs: https://docs.pagar.me/reference/criar-pedido-2 · /criar-cartão · /pix-2 · /cartão-de-crédito-1
import { onlyDigits } from "../shipping";
import type { Order } from "../types";

// PAGARME_API_URL só para teste local (simulador em scripts/pagarme-mock.mjs).
const API = process.env.PAGARME_API_URL || "https://api.pagar.me/core/v5";

export const pagarmeEnabled = () => !!process.env.PAGARME_SECRET_KEY;

export type BillingAddress = { zip: string; street: string; number: string; complement?: string; district: string; city: string; uf: string };
export type CardPayment = { token: string; installments: number; billing: BillingAddress; statementDescriptor?: string };

export type PagarmeCharge = {
  id: string;
  status: string; // pending | paid | failed | canceled | processing | ...
  last_transaction?: {
    status?: string; // captured | not_authorized | waiting_payment | ...
    qr_code?: string;
    qr_code_url?: string;
    expires_at?: string;
    acquirer_message?: string;
    gateway_response?: { code?: string; errors?: { message?: string }[] };
  };
};
export type PagarmeOrder = { id: string; code: string; status: string; metadata?: Record<string, string>; charges?: PagarmeCharge[] };

export class PagarmeError extends Error {
  constructor(message: string, public status: number, public detail?: unknown) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const key = process.env.PAGARME_SECRET_KEY;
  if (!key) throw new PagarmeError("Pagar.me não configurada", 500);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const d = data as { message?: string; errors?: Record<string, string[]> } | null;
    const fields = d?.errors ? Object.entries(d.errors).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ") : "";
    throw new PagarmeError(`Pagar.me ${res.status}: ${d?.message ?? "erro"}${fields ? ` (${fields})` : ""}`, res.status, data);
  }
  return data as T;
}

function phones(phone: string) {
  const d = onlyDigits(phone);
  return { mobile_phone: { country_code: "55", area_code: d.slice(0, 2), number: d.slice(2) } };
}

function address(b: BillingAddress) {
  return {
    line_1: `${b.number}, ${b.street}, ${b.district}`.slice(0, 256),
    line_2: (b.complement ?? "").slice(0, 128) || undefined,
    zip_code: onlyDigits(b.zip),
    city: b.city.slice(0, 64),
    state: b.uf.toUpperCase(),
    country: "BR",
  };
}

function customer(order: Order, billing?: BillingAddress) {
  return {
    name: order.name.slice(0, 64),
    email: order.email.slice(0, 64),
    code: onlyDigits(order.cpf),
    document: onlyDigits(order.cpf),
    document_type: "CPF",
    type: "individual",
    phones: phones(order.phone),
    ...(billing ? { address: address(billing) } : {}),
  };
}

// Itens com o desconto (cupom + Pix) já distribuído: a soma fecha exatamente com o total do pedido.
function items(order: Order) {
  const gross = order.items.reduce((n, i) => n + i.unitCents * i.quantity, 0);
  let left = order.totalCents;
  return order.items.map((i, idx) => {
    const line = i.unitCents * i.quantity;
    const amount = idx === order.items.length - 1 ? left : Math.round((line * order.totalCents) / gross);
    left -= amount;
    return { code: i.variantId.slice(0, 52), description: `${i.quantity}x ${i.name} · ${i.variantLabel}`.slice(0, 256), amount, quantity: 1 };
  });
}

const base = (order: Order, attempt: number) => ({
  code: (attempt > 1 ? `${order.code}-${attempt}` : order.code).slice(0, 52),
  items: items(order),
  closed: true,
  metadata: { order_id: order.id, order_code: order.code, store: "bora-store" },
});

export async function createPixOrder(order: Order, expiresInSeconds: number, attempt = 1) {
  return call<PagarmeOrder>("POST", "/orders", {
    ...base(order, attempt),
    customer: customer(order),
    payments: [{ payment_method: "pix", pix: { expires_in: expiresInSeconds, additional_information: [{ name: "Pedido", value: order.code }] } }],
  });
}

export async function createCardOrder(order: Order, card: CardPayment, attempt = 1) {
  // 1) cliente (o e-mail é único: se já existe, a Pagar.me atualiza) · 2) cartão salvo a partir do token · 3) pedido
  const cus = await call<{ id: string }>("POST", "/customers", customer(order, card.billing));
  const saved = await call<{ id: string }>("POST", `/customers/${cus.id}/cards`, { token: card.token, billing_address: address(card.billing) });
  return call<PagarmeOrder>("POST", "/orders", {
    ...base(order, attempt),
    customer_id: cus.id,
    payments: [{
      payment_method: "credit_card",
      credit_card: { installments: Math.max(1, Math.min(12, card.installments)), statement_descriptor: (card.statementDescriptor || "BORA STORE").slice(0, 13), operation_type: "auth_and_capture", card_id: saved.id },
    }],
  });
}

export const getPagarmeOrder = (id: string) => call<PagarmeOrder>("GET", `/orders/${encodeURIComponent(id)}`);

export function chargeOf(o: PagarmeOrder) {
  return o.charges?.[0] ?? null;
}

/** Mensagem curta para quem está pagando quando o cartão não passa. */
export function refusalMessage(o: PagarmeOrder) {
  const t = chargeOf(o)?.last_transaction;
  const raw = t?.acquirer_message || t?.gateway_response?.errors?.[0]?.message || "";
  return raw ? `O cartão não foi aprovado (${raw}). Confira os dados ou use outro cartão ou o Pix.` : "O cartão não foi aprovado. Confira os dados ou use outro cartão ou o Pix.";
}
