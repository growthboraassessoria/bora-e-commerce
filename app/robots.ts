import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/config";

// Fora do Google até NEXT_PUBLIC_SITE_INDEXABLE=1. Depois: tudo liberado, menos compra, pós-compra e API.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/checkout", "/carrinho", "/obrigado", "/pagamento", "/api"] }], sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
