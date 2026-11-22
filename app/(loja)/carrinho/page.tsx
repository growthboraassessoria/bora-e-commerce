import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { SALES_OPEN } from "@/lib/config";
import SalesClosed from "@/components/ui/SalesClosed";
import CartPage from "@/components/checkout/CartPage";
import { queryProducts } from "@/lib/server/catalog";

export const metadata: Metadata = pageMeta({ title: "Sacola", description: "Sua sacola na BORA Store.", path: "/carrinho", noindex: true });

export default async function Page() {
  if (!SALES_OPEN) return <SalesClosed />;
  const suggestions = (await queryProducts({ sort: "destaques", onlyAvailable: true })).slice(0, 4);
  return <CartPage suggestions={suggestions} />;
}
