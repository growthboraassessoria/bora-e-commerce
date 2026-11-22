"use client";
// Regras de pagamento do BORA OS para os componentes do navegador (vitrine, produto, checkout).
import { createContext, useContext } from "react";
import { DEFAULT_RULES, type PaymentRules } from "@/lib/payment-rules";

const Ctx = createContext<PaymentRules>(DEFAULT_RULES);
export const usePaymentRules = () => useContext(Ctx);
export default function PaymentRulesProvider({ rules, children }: { rules: PaymentRules; children: React.ReactNode }) {
  return <Ctx.Provider value={rules}>{children}</Ctx.Provider>;
}
