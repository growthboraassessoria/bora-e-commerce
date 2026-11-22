"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import { resetCheckoutToken } from "@/lib/checkout-session";

export type PurchaseInfo = {
  transactionId: string;
  valueCents: number;
  coupon: string | null;
  paymentType: "pix" | "card";
  items: { item_id: string; item_name: string; item_variant: string; price: number; quantity: number }[];
};

// Na página de obrigado: esvazia a sacola, encerra o checkout desta compra, avisa o "purchase" (uma vez por pedido)
// e, enquanto o pagamento está pendente, confere o status a cada 5 s.
export default function AfterOrder({ pending, purchase }: { pending: boolean; purchase?: PurchaseInfo | null }) {
  const router = useRouter();
  useEffect(() => {
    resetCheckoutToken();
    cart.clear();
    try { localStorage.removeItem("bora-checkout-draft"); } catch {}
  }, []);
  useEffect(() => {
    if (!purchase) return;
    const key = `bora-purchase-${purchase.transactionId}`;
    try {
      if (sessionStorage.getItem(key) || localStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      localStorage.setItem(key, "1");
    } catch {}
    track("purchase", {
      transaction_id: purchase.transactionId, value: purchase.valueCents / 100, currency: "BRL",
      coupon: purchase.coupon ?? undefined, payment_type: purchase.paymentType, items: purchase.items,
    });
  }, [purchase]);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => router.refresh(), 5000);
    const stop = setTimeout(() => clearInterval(t), 10 * 60_000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [pending, router]);
  return null;
}
