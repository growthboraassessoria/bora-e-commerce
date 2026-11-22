// Resumo do pagamento guardado no pedido (loja.orders.payment_data) e mostrado no BORA OS.
// Nunca guarda número completo do cartão, CVV, QR Code ou chave: só o que a Pagar.me devolve para conferência.
export type PaymentEvent = { type: string; at: string; status?: string | null };

export type PaymentData = {
  provider: "pagarme" | "simulado";
  method: "pix" | "credit_card";
  /** Pedido na Pagar.me (or_…) e código enviado (BR-…). */
  orderId?: string | null;
  orderCode?: string | null;
  orderStatus?: string | null;
  /** Cobrança (ch_…). */
  chargeId?: string | null;
  chargeStatus?: string | null;
  gatewayId?: string | null;
  amountCents?: number | null;
  paidAmountCents?: number | null;
  createdAt?: string | null;
  paidAt?: string | null;
  installments?: number | null;
  statementDescriptor?: string | null;
  customerId?: string | null;
  card?: { brand?: string | null; firstSix?: string | null; lastFour?: string | null; holderName?: string | null; expMonth?: number | null; expYear?: number | null } | null;
  transaction?: {
    id?: string | null;
    type?: string | null;
    status?: string | null;
    success?: boolean | null;
    operationType?: string | null;
    acquirerName?: string | null;
    acquirerMessage?: string | null;
    acquirerReturnCode?: string | null;
    authCode?: string | null;
    nsu?: string | null;
    tid?: string | null;
    antifraud?: { status?: string | null; returnCode?: string | null; message?: string | null; provider?: string | null } | null;
    errors?: string[];
  } | null;
  pix?: { expiresAt?: string | null; endToEndId?: string | null; payerName?: string | null; payerDocument?: string | null; payerBank?: string | null } | null;
  /** Avisos recebidos e consultas feitas (mais recente por último, no máximo 30). */
  events?: PaymentEvent[];
  updatedAt: string;
};

/** Junta um resumo novo com o que já estava salvo, somando o evento ao histórico. */
export function mergePaymentData(prev: PaymentData | null | undefined, next: Partial<PaymentData> | null, event?: PaymentEvent | null): PaymentData {
  const base = (prev ?? {}) as PaymentData;
  const merged = { ...base, ...(next ?? {}), updatedAt: new Date().toISOString() } as PaymentData;
  const events = [...(base.events ?? [])];
  if (event) events.push(event);
  merged.events = events.slice(-30);
  return merged;
}
