// Pagar.me no navegador: gera o token do cartão com a CHAVE PÚBLICA (nunca a secreta).
// O número do cartão vai direto para a Pagar.me; o servidor da loja só recebe o token (vale 60 s, uso único).
// Docs: https://docs.pagar.me/reference/criar-token-cartão-1 (o domínio precisa estar cadastrado na conta).

export const PAGARME_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY ?? "";
export const pagarmeCardEnabled = () => !!PAGARME_PUBLIC_KEY;

export type CardInput = { number: string; holder: string; exp: string; cvv: string };

export type Brand = "visa" | "mastercard" | "amex" | "elo" | null;

// Bandeiras aceitas pela BORA: Visa, Mastercard, American Express e Elo.
export function cardBrand(num: string): Brand {
  const n = num.replace(/\D/g, "");
  if (/^(4011(78|79)|43(1274|8935)|45(1416|7393|763(1|2))|50(4175|6699|67[0-7][0-9]|9000)|627780|63(6297|6368)|650(03([^4])|04([0-9])|05(0|1)|4(0[5-9]|3[0-9]|8[5-9]|9[0-9])|5([0-2][0-9]|3[0-8])|9([2-6][0-9]|7[0-8])|541|700|720|901)|651652|655000|655021)/.test(n)) return "elo";
  if (/^3[47]/.test(n)) return "amex";
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]|7[01]|720))/.test(n)) return "mastercard";
  return null;
}

export const BRAND_LABEL: Record<Exclude<Brand, null>, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", elo: "Elo" };

export function luhn(num: string) {
  const d = num.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 19);
  if (cardBrand(d) === "amex") return d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** Erros por campo, em português. Vazio = pode tokenizar. */
export function cardErrors(c: CardInput, brands?: string[]): Record<string, string> {
  const e: Record<string, string> = {};
  const n = c.number.replace(/\D/g, "");
  if (!luhn(n)) e.cardNumber = "Número inválido";
  else if (!cardBrand(n) || (brands && !brands.includes(cardBrand(n)!))) e.cardNumber = brands ? `Aceitamos ${brands.map((b) => BRAND_LABEL[b as Exclude<Brand, null>] ?? b).join(", ")}` : "Aceitamos Visa, Mastercard, Amex e Elo";
  if (c.holder.trim().split(/\s+/).length < 2 || /[0-9]/.test(c.holder)) e.cardHolder = "Nome como no cartão";
  const [mm, yy] = c.exp.split("/");
  const m = Number(mm), y = 2000 + Number(yy);
  const now = new Date();
  if (!m || m > 12 || !yy || yy.length !== 2 || y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) e.cardExp = "Validade inválida";
  const cvvLen = cardBrand(n) === "amex" ? 4 : 3;
  if (c.cvv.replace(/\D/g, "").length !== cvvLen) e.cardCvv = `CVV com ${cvvLen} dígitos`;
  return e;
}

export async function tokenizeCard(c: CardInput): Promise<string> {
  if (!PAGARME_PUBLIC_KEY) throw new Error("Pagamento com cartão indisponível agora.");
  const [mm, yy] = c.exp.split("/");
  const api = process.env.NEXT_PUBLIC_PAGARME_API_URL || "https://api.pagar.me/core/v5"; // troca só em teste local
  const res = await fetch(`${api}/tokens?appId=${encodeURIComponent(PAGARME_PUBLIC_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "card",
      card: { number: c.number.replace(/\D/g, ""), holder_name: c.holder.trim().toUpperCase().slice(0, 64), exp_month: Number(mm), exp_year: Number(yy), cvv: c.cvv.replace(/\D/g, "") },
    }),
  }).catch(() => null);
  if (!res) throw new Error("Sem conexão com o processador de pagamento. Tente de novo.");
  const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok || !data?.id) {
    if (res.status === 401 || res.status === 403) throw new Error("O pagamento com cartão ainda não está liberado neste endereço. Use o Pix ou tente mais tarde.");
    throw new Error("Não conseguimos validar o cartão. Confira número, validade e CVV.");
  }
  return data.id;
}
