import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL, STORE } from "../config";
import { onlyDigits } from "../shipping";
import { HOLD_MINUTES, orderToken } from "./orders";
import type { Order } from "../types";
import { createPixOrder, pagarmeEnabled } from "./pagarme";
import { getPaymentRules } from "./settings";

// Gateway: Pagar.me (checkout transparente, lib/server/pagarme.ts). Sem PAGARME_SECRET_KEY, pagamento simulado.
// O Mercado Pago ficou só como código de referência (não é mais escolhido).
// Trava: com a loja em demonstração (NEXT_PUBLIC_SALES_DEMO=1, faixa "nada é cobrado"), o pagamento é sempre simulado,
// mesmo com a chave da Pagar.me cadastrada. Tirar a demonstração liga a cobrança real.
export const paymentProvider = (): Order["paymentProvider"] =>
  pagarmeEnabled() && process.env.NEXT_PUBLIC_SALES_DEMO !== "1" ? "pagarme" : "simulado";

const MP = "https://api.mercadopago.com";

export async function startPayment(order: Order): Promise<{ redirectUrl: string; paymentRef: string | null }> {
  const token = orderToken(order.id);
  if (order.paymentProvider === "simulado") {
    return { redirectUrl: `/pagamento/${order.id}?t=${token}`, paymentRef: null };
  }
  if (order.paymentProvider === "pagarme") {
    // Só o Pix passa por aqui; o cartão é cobrado direto na ação do checkout (precisa do token do navegador).
    const rules = await getPaymentRules();
    const po = await createPixOrder(order, Math.min(rules.pixExpiresMinutes, HOLD_MINUTES.pix) * 60);
    return { redirectUrl: `/pagamento/${order.id}?t=${token}`, paymentRef: po.id };
  }

  const excluded = {
    pix: [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }, { id: "atm" }],
    card: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }],
  }[order.paymentMethod];

  const [first, ...rest] = order.name.trim().split(/\s+/);
  const back = `${SITE_URL}/obrigado/${order.id}?t=${token}`;
  const body = {
    external_reference: order.id,
    statement_descriptor: "BORA STORE",
    // Um item com o total: o MP não aceita linha com valor negativo (desconto) nem frete separado no Pix.
    items: [{ id: `pedido-${order.number}`, title: `Pedido BORA #${order.number}`, quantity: 1, currency_id: "BRL", unit_price: order.totalCents / 100 }],
    payer: {
      name: first, surname: rest.join(" "), email: order.email,
      identification: { type: "CPF", number: onlyDigits(order.cpf) },
      phone: { area_code: onlyDigits(order.phone).slice(0, 2), number: onlyDigits(order.phone).slice(2) },
    },
    payment_methods: { excluded_payment_types: excluded, installments: STORE.maxInstallments },
    back_urls: { success: back, pending: back, failure: `${SITE_URL}/checkout?erro=pagamento` },
    auto_return: "approved",
    notification_url: `${SITE_URL}/api/webhooks/mercadopago`,
    expires: true,
    expiration_date_to: new Date(Date.now() + HOLD_MINUTES[order.paymentMethod] * 60_000).toISOString(),
    metadata: { order_number: order.number },
  };

  const res = await fetch(`${MP}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": order.id },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Mercado Pago recusou a preferência (${res.status})`);
  const pref = (await res.json()) as { id: string; init_point: string };
  return { redirectUrl: pref.init_point, paymentRef: pref.id };
}

export async function fetchMpPayment(paymentId: string) {
  const res = await fetch(`${MP}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: number; status: string; external_reference: string; transaction_amount: number };
}

// Confere a assinatura do webhook (x-signature: "ts=...,v1=...").
export function validMpSignature(headers: Headers, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // sem segredo configurado, a segurança vem de consultar o pagamento na API do MP
  const sig = headers.get("x-signature") || "";
  const requestId = headers.get("x-request-id") || "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
