import type { ShippingOption } from "./types";

export const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

// Sem envio pelo Brasil: toda venda é retirada no local do evento (dados em lib/presale.ts).
export const PICKUP: ShippingOption = { id: "retirada", label: "Retirada no evento · grátis", days: "No dia da prova, das 4h às 11h", cents: 0 };

export function shippingOptions(): ShippingOption[] {
  return [PICKUP];
}

export const formatCep = (cep: string) => {
  const d = onlyDigits(cep).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
