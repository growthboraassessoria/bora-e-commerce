"use client";
// Textos de pagamento que seguem as regras do BORA OS (para conteúdo estático, como as políticas).
import { brl } from "@/lib/money";
import { brandList, pixBadge, paymentSentence } from "@/lib/payment-rules";
import { usePaymentRules } from "./PaymentRulesProvider";

export default function PaymentText({ kind }: { kind: "sentence" | "badge" | "pix" | "card" }) {
  const r = usePaymentRules();
  if (kind === "sentence") return <>{paymentSentence(r)}</>;
  if (kind === "badge") return <>{pixBadge(r)}</>;
  if (kind === "pix") {
    if (!r.pixEnabled) return <>O Pix está desligado no momento.</>;
    return <>{r.pixDiscountPct > 0 ? `${r.pixDiscountPct}% de desconto sobre os produtos. ` : "Aprovação na hora. "}O QR Code vale por {r.pixExpiresMinutes} minutos; se o pagamento não cair, o pedido é cancelado e as peças voltam para o estoque.</>;
  }
  if (!r.cardEnabled) return <>O cartão está desligado no momento.</>;
  return <>{r.maxInstallments > 1 ? `Em até ${r.maxInstallments}x sem juros, com parcela mínima de ${brl(r.minInstallmentCents)}.` : "À vista."} Aceitamos {brandList(r)}.</>;
}
