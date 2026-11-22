// Regras de pagamento da loja, definidas no BORA OS (Loja → Pagar.me) e guardadas em loja.settings.payment.
// Arquivo sem dependência de servidor: vale na loja (servidor e navegador). O servidor sempre confere de novo.
import { installments } from "./money";

export type CardBrandId = "visa" | "mastercard" | "amex" | "elo";
export const ALL_BRANDS: CardBrandId[] = ["visa", "mastercard", "amex", "elo"];
export const BRAND_NAMES: Record<CardBrandId, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", elo: "Elo" };

export type PaymentRules = {
  pixEnabled: boolean;
  /** Desconto do Pix sobre os produtos, em % (0 a 30). */
  pixDiscountPct: number;
  /** Validade do QR Code do Pix, em minutos (10 a 60; a reserva das peças dura 60). */
  pixExpiresMinutes: number;
  cardEnabled: boolean;
  /** Parcelas sem juros (1 a 12). */
  maxInstallments: number;
  /** Valor mínimo de cada parcela, em centavos. */
  minInstallmentCents: number;
  brands: CardBrandId[];
  /** Nome na fatura do cartão (até 13 letras, números e espaço). */
  statementDescriptor: string;
};

export const DEFAULT_RULES: PaymentRules = {
  pixEnabled: true,
  pixDiscountPct: 5,
  pixExpiresMinutes: 60,
  cardEnabled: true,
  maxInstallments: 3,
  minInstallmentCents: 3000,
  brands: [...ALL_BRANDS],
  statementDescriptor: "BORA STORE",
};

const int = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Aceita o que vier do banco e devolve regras válidas (o que faltar usa o padrão). */
export function normalizeRules(raw: unknown): PaymentRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_RULES;
  const brands = Array.isArray(r.brands) ? ALL_BRANDS.filter((b) => (r.brands as unknown[]).includes(b)) : d.brands;
  const desc = typeof r.statementDescriptor === "string" ? r.statementDescriptor.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, 13) : "";
  return {
    pixEnabled: typeof r.pixEnabled === "boolean" ? r.pixEnabled : d.pixEnabled,
    pixDiscountPct: int(r.pixDiscountPct, 0, 30, d.pixDiscountPct),
    pixExpiresMinutes: int(r.pixExpiresMinutes, 10, 60, d.pixExpiresMinutes),
    cardEnabled: typeof r.cardEnabled === "boolean" ? r.cardEnabled : d.cardEnabled,
    maxInstallments: int(r.maxInstallments, 1, 12, d.maxInstallments),
    minInstallmentCents: int(r.minInstallmentCents, 500, 100000, d.minInstallmentCents),
    brands: brands.length ? brands : d.brands,
    statementDescriptor: desc || d.statementDescriptor,
  };
}

/** Parcelas possíveis para um valor, pelas regras (número máximo e parcela mínima). */
export const installmentsFor = (cents: number, r: PaymentRules) => installments(cents, r.maxInstallments, r.minInstallmentCents);

/** Desconto do Pix que vale na vitrine (0 quando o Pix está desligado). */
export const pixPct = (r: PaymentRules) => (r.pixEnabled ? r.pixDiscountPct : 0);

/** Frase curta para vitrine: "5% off no Pix", "Pix com aprovação na hora" ou vazio. */
export const pixBadge = (r: PaymentRules) => (!r.pixEnabled ? "" : r.pixDiscountPct > 0 ? `${r.pixDiscountPct}% off no Pix` : "Pix com aprovação na hora");

export const brandList = (r: PaymentRules) => {
  const names = r.brands.map((b) => BRAND_NAMES[b]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0] ?? "";
};

/** Frase das formas de pagamento para FAQs e políticas. */
export function paymentSentence(r: PaymentRules) {
  const parts: string[] = [];
  if (r.pixEnabled) parts.push(r.pixDiscountPct > 0 ? `Pix com ${r.pixDiscountPct}% de desconto` : "Pix");
  if (r.cardEnabled) parts.push(`cartão ${brandList(r)}${r.maxInstallments > 1 ? ` em até ${r.maxInstallments}x sem juros` : " à vista"}`);
  return parts.length ? parts.join(" ou ") : "Pagamentos temporariamente pausados";
}
