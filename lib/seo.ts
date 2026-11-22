// SEO da BORA Store: metadata padrão por página e dados estruturados (JSON-LD, schema.org).
// O noindex até o lançamento continua no app/layout.tsx (INDEXABLE em lib/config.ts).
import type { Metadata } from "next";
import { INDEXABLE, SITE_URL, STORE } from "./config";
import { PICKUP, PRESALE } from "./presale";
import type { Product } from "./types";

export const SITE_NAME = "BORA Store";
export const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
/** Imagem de compartilhamento padrão (gerada em app/opengraph-image.tsx). */
export const DEFAULT_OG = { url: "/opengraph-image", width: 1200, height: 630, alt: "BORA Store · Vista o movimento" };

type PageMeta = {
  title: string;
  description: string;
  path: string;
  /** Imagem de compartilhamento. Sem ela, vale a imagem da marca. `false` = deixa a imagem do arquivo opengraph-image da rota. */
  image?: { url: string; width?: number; height?: number; alt?: string } | false;
  /** Página que não deve ir para o Google mesmo depois do lançamento (busca, sacola...). */
  noindex?: boolean;
  type?: "website" | "article";
};

/** Metadata completo de uma página: título, descrição, canonical, Open Graph e cartão do X/Twitter. */
export function pageMeta({ title, description, path, image, noindex, type = "website" }: PageMeta): Metadata {
  const desc = description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
  return {
    title,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "pt_BR",
      siteName: SITE_NAME,
      url: path,
      title: `${title} · ${SITE_NAME}`,
      description: desc,
      ...(image === false ? {} : { images: [image ?? DEFAULT_OG] }),
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description: desc },
    // Sem noindex próprio, vale o do layout (fora do Google até INDEXABLE).
    ...(noindex ? { robots: { index: false, follow: INDEXABLE } } : {}),
  };
}

// ---------- JSON-LD ----------
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const phone = () => {
  const d = STORE.whatsappUrl.replace(/\D/g, ""); // 5531984133066
  return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, d.length - 4)}-${d.slice(-4)}`;
};

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "BORA",
    legalName: "BORA Assessoria LTDA",
    taxID: STORE.cnpj,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: abs("/img/marca/logo-black.png") },
    image: abs("/img/marca/simbolo-black.png"),
    email: STORE.email,
    telephone: phone(),
    sameAs: [STORE.instagram],
    address: { "@type": "PostalAddress", streetAddress: "Av. Luiz Paulo Franco, 500, Loja 7 2S, Belvedere", addressLocality: "Belo Horizonte", addressRegion: "MG", addressCountry: "BR" },
    contactPoint: [
      { "@type": "ContactPoint", contactType: "customer service", email: STORE.email, telephone: phone(), url: STORE.whatsappUrl, areaServed: "BR", availableLanguage: ["pt-BR"] },
      { "@type": "ContactPoint", contactType: "sales", email: STORE.email, telephone: phone(), areaServed: "BR", availableLanguage: ["pt-BR"] },
    ],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "pt-BR",
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/busca?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function itemListLd(name: string, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/produto/${p.slug}`), name: p.name, image: p.images[0] ? abs(p.images[0].url) : undefined })),
  };
}

export function faqLd(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.filter((f) => f.q && f.a).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

const money = (cents: number) => (cents / 100).toFixed(2);

/** SKU do produto = parte comum dos SKUs das variantes (ex.: CAM-PRT-P e CAM-NEO-M → CAM). */
function productSku(p: Product) {
  const skus = p.variants.map((v) => v.sku).filter(Boolean);
  if (!skus.length) return p.id;
  if (skus.length === 1) return skus[0];
  let pre = skus[0];
  for (const s of skus) while (!s.startsWith(pre)) pre = pre.slice(0, -1);
  pre = pre.replace(/[-_ ]+$/, "");
  return pre.length >= 3 ? pre : p.id;
}

export function productLd(p: Product, categoryName?: string) {
  const url = abs(`/produto/${p.slug}`);
  const prices = p.variants.map((v) => v.priceCents ?? p.priceCents);
  const low = prices.length ? Math.min(...prices) : p.priceCents;
  const high = prices.length ? Math.max(...prices) : p.priceCents;
  const stock = p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
  const presale = p.tags.includes(PRESALE.tag) || PRESALE.productSlugs.includes(p.slug);
  const availability = stock <= 0 ? "https://schema.org/OutOfStock" : presale ? "https://schema.org/PreOrder" : "https://schema.org/InStock";
  const colors = [...new Set(p.variants.map((v) => v.color).filter(Boolean))];
  const seller = { "@type": "Organization", "@id": ORG_ID, name: "BORA" };
  // Entrega: só retirada no evento (sem envio pelo correio), sem custo.
  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingLabel: `Retirada no evento: ${PICKUP.address}, ${PICKUP.city}`,
    shippingRate: { "@type": "MonetaryAmount", value: "0.00", currency: "BRL" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR", addressRegion: "MG" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
    },
  };
  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "BR",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
    returnMethod: "https://schema.org/ReturnInStore",
    returnFees: "https://schema.org/FreeReturn",
    merchantReturnLink: abs("/politicas/trocas-e-devolucoes"),
  };
  const common = {
    priceCurrency: "BRL",
    availability,
    itemCondition: "https://schema.org/NewCondition",
    url,
    seller,
    availableDeliveryMethod: "https://schema.org/OnSitePickup",
    shippingDetails,
    hasMerchantReturnPolicy: returnPolicy,
  };
  const offers =
    low === high
      ? { "@type": "Offer", price: money(low), ...common }
      : { "@type": "AggregateOffer", lowPrice: money(low), highPrice: money(high), offerCount: p.variants.length, ...common };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    description: p.description || p.subtitle,
    image: p.images.map((i) => abs(i.url)),
    sku: productSku(p),
    productID: p.id,
    brand: { "@type": "Brand", name: "BORA" },
    ...(categoryName ? { category: categoryName } : {}),
    ...(colors.length ? { color: colors.join(", ") } : {}),
    url,
    offers,
  };
}
