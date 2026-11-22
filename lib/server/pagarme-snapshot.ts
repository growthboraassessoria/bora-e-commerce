import "server-only";
// Converte o pedido da Pagar.me (API v5) no resumo guardado no nosso pedido. Campos que a Pagar.me não mandar ficam vazios.
import type { PaymentData } from "../payment-data";

type Any = Record<string, unknown>;
const s = (v: unknown) => (v == null || v === "" ? null : String(v));
const n = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const o = (v: unknown) => (v && typeof v === "object" ? (v as Any) : {});

/** CPF/CNPJ do pagador do Pix: só os 3 primeiros e os 2 últimos números. */
const maskDoc = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d ? `${d.slice(0, 3)}.•••.•••-${d.slice(-2)}` : null;
};

export function snapshotOf(po: unknown): Partial<PaymentData> {
  const order = o(po);
  const charge = o((order.charges as unknown[] | undefined)?.[0]);
  const tx = o(charge.last_transaction);
  const card = o(tx.card);
  const af = o(tx.antifraud_response);
  const gw = o(tx.gateway_response);
  const payer = o(tx.payer ?? (o(tx.pix_provider_tid).payer as unknown));
  const method = (s(charge.payment_method) ?? s(tx.transaction_type) ?? "") === "pix" ? "pix" : "credit_card";
  const errors = Array.isArray(gw.errors) ? (gw.errors as Any[]).map((e) => s(e.message)).filter((x): x is string => !!x) : [];
  return {
    provider: "pagarme",
    method,
    orderId: s(order.id),
    orderCode: s(order.code),
    orderStatus: s(order.status),
    chargeId: s(charge.id),
    chargeStatus: s(charge.status),
    gatewayId: s(charge.gateway_id ?? tx.gateway_id),
    amountCents: n(charge.amount ?? order.amount),
    paidAmountCents: n(charge.paid_amount),
    createdAt: s(order.created_at ?? charge.created_at),
    paidAt: s(charge.paid_at),
    installments: n(tx.installments),
    statementDescriptor: s(tx.statement_descriptor),
    customerId: s(o(order.customer).id ?? o(charge.customer).id),
    card: method === "credit_card" && Object.keys(card).length
      ? { brand: s(card.brand), firstSix: s(card.first_six_digits), lastFour: s(card.last_four_digits), holderName: s(card.holder_name), expMonth: n(card.exp_month), expYear: n(card.exp_year) }
      : null,
    transaction: Object.keys(tx).length
      ? {
          id: s(tx.id), type: s(tx.transaction_type), status: s(tx.status), success: typeof tx.success === "boolean" ? tx.success : null,
          operationType: s(tx.operation_type), acquirerName: s(tx.acquirer_name), acquirerMessage: s(tx.acquirer_message),
          acquirerReturnCode: s(tx.acquirer_return_code), authCode: s(tx.acquirer_auth_code), nsu: s(tx.acquirer_nsu), tid: s(tx.acquirer_tid),
          antifraud: Object.keys(af).length ? { status: s(af.status), returnCode: s(af.return_code), message: s(af.return_message), provider: s(af.provider_name) } : null,
          errors,
        }
      : null,
    pix: method === "pix"
      ? { expiresAt: s(tx.expires_at), endToEndId: s(tx.end_to_end_id ?? o(tx.metadata).end_to_end_id), payerName: s(payer.name), payerDocument: maskDoc(payer.document), payerBank: s(o(payer.bank_account).bank_name) }
      : null,
  };
}
