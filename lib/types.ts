export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  position: number;
};

export type ProductImage = { url: string; alt: string; color?: string | null };

export type Variant = {
  id: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  priceCents: number | null; // null = usa o preço do produto
  stock: number;
  /** Cadastro do BORA OS (padrão Shopify): valor de cada opção, ex. { Cor: "Preto", Tamanho: "M", Estilo: "Cropped" }. */
  options?: Record<string, string>;
  /** Foto própria da variante (senão, a foto da cor). */
  image?: string | null;
  compareAtCents?: number | null;
  barcode?: string | null;
};

/** Opção do produto (até 3): nome livre e valores, na ordem. Cor pode ter o código da cor. */
export type ProductOption = { name: string; values: { value: string; hex?: string | null }[] };

export type Product = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  priceCents: number;
  compareAtCents: number | null;
  badges: string[];
  tags: string[];
  featured: boolean;
  highlights: string[];
  details: { label: string; value: string }[];
  care: string;
  images: ProductImage[];
  variants: Variant[];
  position: number;
  status?: "active" | "draft" | "archived"; // draft (rascunho) e archived (arquivado) = ocultos da loja
  /** Cadastro do BORA OS: opções, tipo, custo, SEO e coleções (várias, com a ordem do produto dentro de cada uma). */
  options?: ProductOption[];
  productType?: string;
  costCents?: number | null;
  seoTitle?: string;
  seoDescription?: string;
  collections?: string[];
  collectionPos?: Record<string, number>;
};

export type CartLine = { variantId: string; quantity: number };

export type PricedLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  image: string;
  unitCents: number;
  quantity: number;
  stock: number;
  /** Categoria do produto + etiquetas (para descontos por categoria). */
  categories?: string[];
};

export type ShippingOption = { id: "pac" | "sedex" | "retirada"; label: string; days: string; cents: number };

export type Address = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
};

export type OrderStatus = "pending" | "paid" | "canceled" | "shipped" | "delivered" | "refunded";

export type OrderEvent = {
  kind: "created" | "paid" | "expired" | "canceled" | "refunded" | "picked_up" | "pickup_undone" | "note" | "attention"
    // Etapas do pedido (0005; ver lib/etapas.ts).
    | "processing" | "packed" | "ready" | "shipped" | "delivered" | "stage_undone";
  actor: string; note?: string | null; at: string;
};

export type Order = {
  id: string;
  /** ID do pedido, ex.: BR-7KQ2M9 */
  code: string;
  number: number;
  status: OrderStatus;
  email: string;
  name: string;
  phone: string;
  cpf: string;
  address: Address | null;
  shippingMethod: ShippingOption["id"];
  shippingCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
  paymentMethod: "pix" | "card";
  paymentProvider: "pagarme" | "mercadopago" | "simulado";
  paymentId: string | null;
  createdAt: string;
  paidAt: string | null;
  /** Quem retira, quando não é o comprador (nulo = o próprio comprador). */
  pickupName?: string | null;
  pickupCpf?: string | null;
  pickupPhone?: string | null;
  pickedUpAt?: string | null;
  pickedUpBy?: string | null;
  canceledAt?: string | null;
  refundedAt?: string | null;
  /** Etapas do pedido marcadas no BORA OS (0005; ver lib/etapas.ts). shipped = pronto para retirada ou enviado. */
  processingAt?: string | null;
  processingBy?: string | null;
  packedAt?: string | null;
  packedBy?: string | null;
  shippedAt?: string | null;
  shippedBy?: string | null;
  events?: OrderEvent[];
  /** Resumo do pagamento devolvido pela Pagar.me (ou simulado). Ver lib/payment-data.ts. */
  paymentData?: import("./payment-data").PaymentData | null;
  /** De onde veio a compra: IP, CEP de cobrança e GPS (com permissão). Ver lib/geo.ts. */
  geo?: import("./geo").OrderGeo | null;
  items: {
    variantId: string;
    productId: string;
    name: string;
    variantLabel: string;
    image: string;
    unitCents: number;
    quantity: number;
  }[];
};

export type Coupon = {
  code: string;
  /** Nome que aparece para o cliente (ex.: "Black Friday BORA"). Vazio = usa o código. */
  title?: string;
  /** code = cupom digitado; automatic = entra sozinho quando as condições batem. */
  method?: "code" | "automatic";
  kind: "percent" | "fixed" | "free_shipping";
  value: number; // percent: 0-100; fixed: centavos
  /** all = sacola toda; products = só productIds; categories = só categorySlugs. */
  appliesTo?: "all" | "products" | "categories";
  productIds?: string[];
  categorySlugs?: string[];
  /** Requisito mínimo, sempre sobre os itens que participam do desconto. */
  minSubtotalCents: number;
  minQuantity?: number;
  active: boolean;
  startsAt?: string | null;
  expiresAt: string | null;
  /** Usos já feitos e limite (nulo = sem limite). */
  uses?: number;
  maxUses?: number | null;
  /** Um uso por CPF (conferido no servidor ao criar o pedido). */
  oncePerCustomer?: boolean;
  /** Se false, o desconto do Pix não entra junto. */
  combinesWithPix?: boolean;
};

/** Desconto que entrou no orçamento (vai para o resumo da sacola e do checkout). */
export type AppliedDiscount = {
  code: string;
  title: string;
  automatic: boolean;
  kind: Coupon["kind"];
  discountCents: number;
  combinesWithPix: boolean;
};
