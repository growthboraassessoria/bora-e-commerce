// Dados da loja exibidos no rodapé, nas políticas e no obrigado (mesmos do site da BORA).
export const STORE = {
  name: "BORA Store",
  brand: "BORA",
  tagline: "Corrida, Duathlon e Triathlon",
  legalName: "Bora Assessoria LTDA",
  cnpj: "54.366.041/0001-25",
  address: "Av. Luiz Paulo Franco, 500, Loja 7 2S, Belvedere, Belo Horizonte, MG",
  email: "comercial@boraassessoria.com",
  whatsapp: "(31) 98413-3066",
  whatsappUrl: "https://wa.me/5531984133066",
  hours: "Segunda a sexta, das 9h às 18h",
  instagram: "https://www.instagram.com/bora.assessoria/",
  instagramHandle: "@bora.assessoria",
  freeShippingCents: 29900,
  maxInstallments: 3,
  pixDiscountPct: 5,
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3500";

/**
 * Vendas abertas. Em produção só com NEXT_PUBLIC_SALES_OPEN=1 (banco e Pagar.me ligados);
 * sem isso a loja é vitrine: os botões de compra chamam no WhatsApp. Em desenvolvimento ficam abertas.
 */
export const SALES_OPEN = process.env.NEXT_PUBLIC_SALES_OPEN ? process.env.NEXT_PUBLIC_SALES_OPEN === "1" : process.env.NODE_ENV !== "production";
/** Fora do Google até NEXT_PUBLIC_SITE_INDEXABLE=1. */
export const INDEXABLE = process.env.NEXT_PUBLIC_SITE_INDEXABLE === "1";
export const waLink = (msg: string) => `${STORE.whatsappUrl}?text=${encodeURIComponent(msg)}`;
/** Demonstração: compra aberta com pagamento simulado. Mostra a faixa "nada é cobrado" no topo. */
// Faixa de demonstração: nunca na produção (VERCEL_ENV=production), mesmo que a variável fique esquecida.
export const DEMO = process.env.NEXT_PUBLIC_SALES_DEMO === "1" && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" && process.env.VERCEL_ENV !== "production";
