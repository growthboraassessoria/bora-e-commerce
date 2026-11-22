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
};

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
  status?: "active" | "draft"; // draft = oculto da loja
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

export type OrderEvent = { kind: "created" | "paid" | "expired" | "canceled" | "refunded" | "picked_up" | "pickup_undone" | "note" | "attention"; actor: string; note?: string | null; at: string };

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
  events?: OrderEvent[];
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
