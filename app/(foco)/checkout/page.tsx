import { simpleOptions } from "@/lib/options";
import type { Metadata } from "next";
import { SALES_OPEN } from "@/lib/config";
import SalesClosed from "@/components/ui/SalesClosed";
import CheckoutForm, { type Recovery, type Suggestion } from "@/components/checkout/CheckoutForm";
import { getAllProducts, getDiscountByCode, variantImage } from "@/lib/server/catalog";
import { getCheckoutForRecovery } from "@/lib/server/checkouts";
import { paymentProvider } from "@/lib/server/payments";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG", "34-38", "39-43", "U"];

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  if (!SALES_OPEN) return <SalesClosed />;
  const sp = await searchParams;
  const error = sp.erro === "pagamento" ? "O pagamento não foi concluído. Você pode tentar de novo ou escolher outra forma." : undefined;
  const cupom = typeof sp.cupom === "string" ? sp.cupom.slice(0, 40).toUpperCase() : undefined;

  // Link de recuperação do carrinho abandonado: remonta a sacola e o contato (sem CPF).
  let recovery: Recovery | undefined;
  const token = typeof sp.recuperar === "string" ? sp.recuperar.slice(0, 64) : "";
  if (token) {
    const c = await getCheckoutForRecovery(token).catch(() => null);
    if (c?.completed) recovery = { token, completed: true };
    else if (c && c.lines.length) {
      // Só volta o cupom se for um código que ainda existe (o automático entra sozinho).
      const coupon = c.couponCode && (await getDiscountByCode(c.couponCode)) ? c.couponCode : undefined;
      recovery = { token, completed: false, lines: c.lines, coupon, contact: { name: c.name, email: c.email, phone: c.phone } };
    }
  }

  // Peças para a sugestão de frete grátis: a primeira cor de cada produto com estoque.
  const suggestions: Suggestion[] = (await getAllProducts())
    .filter((p) => p.variants.some((v) => v.stock > 0) && !p.tags.includes("kit") && simpleOptions(p))
    .map((p) => {
      const color = p.variants.find((v) => v.stock > 0)!.color;
      const vs = p.variants.filter((v) => v.color === color).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
      return {
        slug: p.slug, name: p.name, priceCents: p.priceCents, image: variantImage(p, vs[0]).replace("-1600", "-800"),
        variants: vs.map((v) => ({ id: v.id, label: v.size === "U" ? "Único" : v.size, stock: v.stock })),
      };
    });

  return <CheckoutForm error={error} suggestions={suggestions} initialCoupon={cupom} recovery={recovery} gateway={paymentProvider() === "pagarme" ? "pagarme" : "simulado"} />;
}
