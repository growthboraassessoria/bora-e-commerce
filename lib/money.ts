const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (cents: number) => BRL.format(cents / 100);
export const installments = (cents: number, max = 6, minParcelCents = 3000) => {
  const n = Math.max(1, Math.min(max, Math.floor(cents / minParcelCents)));
  return { n, each: Math.ceil(cents / n) };
};
