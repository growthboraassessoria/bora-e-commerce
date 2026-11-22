import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { db, storeMode } from "./db";
import { withLocalDb, readLocalOrders } from "./local-store";
import { COUPONS, PRODUCTS } from "../catalog-seed";
import type { Address, Order, OrderStatus, PricedLine, ShippingOption } from "../types";
import type { Totals } from "../pricing";
import { codeFromId, newOrderCode } from "../orderCode";
import { recalledOrder } from "./order-cookie";

const SECRET = () => process.env.ORDER_LINK_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret");

// Token que libera a página de obrigado/pagamento de um pedido (sem login).
export function orderToken(id: string) {
  const s = SECRET();
  if (!s) throw new Error("ORDER_LINK_SECRET não configurado");
  return createHmac("sha256", s).update(`order:${id}`).digest("base64url").slice(0, 32);
}

export function checkOrderToken(id: string, token: string | undefined | null) {
  if (!token) return false;
  const a = Buffer.from(orderToken(id));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class OutOfStockError extends Error {
  constructor(public variantId: string) {
    super("sem_estoque");
  }
}

/** O desconto atingiu o limite de usos na hora de criar o pedido (loja.create_order: 'cupom_esgotado:<code>'). */
export class CouponExhaustedError extends Error {
  constructor(public code: string) {
    super("cupom_esgotado");
  }
}

export type NewOrder = {
  email: string; name: string; phone: string; cpf: string; address: Address | null;
  shipping: ShippingOption; paymentMethod: Order["paymentMethod"]; paymentProvider: Order["paymentProvider"];
  couponCode: string | null; lines: PricedLine[]; totals: Totals;
  /** Outra pessoa retira no evento; nulo = o próprio comprador. */
  pickup: { name: string; cpf: string; phone: string } | null;
};

// Tempo para pagar antes do pedido ser cancelado e o estoque voltar.
export const HOLD_MINUTES: Record<Order["paymentMethod"], number> = { pix: 60, card: 60 };

export async function createOrder(input: NewOrder): Promise<Order> {
  const items = input.lines.map((l) => ({
    variantId: l.variantId, productId: l.productId, name: l.name, variantLabel: l.variantLabel, image: l.image, unitCents: l.unitCents, quantity: l.quantity,
  }));
  const base = {
    status: "pending" as OrderStatus,
    email: input.email, name: input.name, phone: input.phone, cpf: input.cpf, address: input.address,
    shippingMethod: input.shipping.id, shippingCents: input.totals.shippingCents, subtotalCents: input.totals.subtotalCents,
    discountCents: input.totals.discountCents + input.totals.pixDiscountCents, totalCents: input.totals.totalCents,
    couponCode: input.couponCode, paymentMethod: input.paymentMethod, paymentProvider: input.paymentProvider, paymentId: null, paidAt: null, items,
    pickupName: input.pickup?.name ?? null, pickupCpf: input.pickup?.cpf ?? null, pickupPhone: input.pickup?.phone ?? null,
  };

  if (storeMode() === "local") {
    return withLocalDb((d) => {
      releaseExpiredLocal(d.orders, d.stock);
      const seed = new Map(PRODUCTS.flatMap((p) => p.variants.map((v) => [v.id, v.stock] as const)));
      for (const it of items) {
        const have = d.stock[it.variantId] ?? seed.get(it.variantId) ?? 0;
        if (have < it.quantity) throw new OutOfStockError(it.variantId);
      }
      if (base.couponCode) {
        // Mesma fonte do orçamento (catalog.ts): descontos gravados pelo BORA OS no arquivo ou, sem eles, os do catálogo.
        const c = (Array.isArray(d.coupons) ? d.coupons : COUPONS).find((x) => x.code === base.couponCode);
        const used = (c?.uses ?? 0) + d.orders.filter((o) => o.couponCode === base.couponCode).length;
        if (!c || !c.active || (c.maxUses != null && used >= c.maxUses)) throw new CouponExhaustedError(base.couponCode);
      }
      for (const it of items) d.stock[it.variantId] = (d.stock[it.variantId] ?? seed.get(it.variantId) ?? 0) - it.quantity;
      const at = new Date().toISOString();
      const code = newOrderCode(new Set(d.orders.map((o) => o.code).filter(Boolean)));
      const order: Order = { ...base, id: randomUUID(), code, number: ++d.seq, createdAt: at, events: [{ kind: "created", actor: "Loja", at }] };
      d.orders.push(order);
      return order;
    });
  }

  await db().rpc("release_expired_orders");
  const { data, error } = await db().rpc("create_order", {
    p_order: {
      email: base.email, name: base.name, phone: base.phone, cpf: base.cpf, address: base.address,
      shipping_method: base.shippingMethod, shipping_cents: base.shippingCents, subtotal_cents: base.subtotalCents,
      discount_cents: base.discountCents, total_cents: base.totalCents, coupon_code: base.couponCode,
      payment_method: base.paymentMethod, payment_provider: base.paymentProvider,
      pickup_name: base.pickupName, pickup_cpf: base.pickupCpf, pickup_phone: base.pickupPhone,
      expires_at: new Date(Date.now() + HOLD_MINUTES[base.paymentMethod] * 60_000).toISOString(),
    },
    p_items: items.map((i) => ({
      variant_id: i.variantId, product_id: i.productId, name: i.name, variant_label: i.variantLabel, image: i.image, unit_cents: i.unitCents, quantity: i.quantity,
    })),
  });
  if (error) {
    const m = /sem_estoque:([\w-]+)/.exec(error.message);
    if (m) throw new OutOfStockError(m[1]);
    const c = /cupom_esgotado:(\S+)/.exec(error.message);
    if (c) throw new CouponExhaustedError(c[1]);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ...base, id: row.id, code: row.code, number: row.number, createdAt: row.created_at };
}

function releaseExpiredLocal(orders: Order[], stock: Record<string, number>) {
  const now = Date.now();
  for (const o of orders) {
    if (o.status !== "pending") continue;
    if (now - new Date(o.createdAt).getTime() < HOLD_MINUTES[o.paymentMethod] * 60_000) continue;
    o.status = "canceled";
    o.canceledAt = new Date().toISOString();
    (o.events ??= []).push({ kind: "expired", actor: "Sistema", note: "Prazo de pagamento terminou; peças voltaram para a grade.", at: o.canceledAt });
    for (const it of o.items) stock[it.variantId] = (stock[it.variantId] ?? 0) + it.quantity;
  }
}

type OrderRow = {
  id: string; number: number; status: OrderStatus; email: string; name: string; phone: string; cpf: string; address: Address;
  shipping_method: Order["shippingMethod"]; shipping_cents: number; subtotal_cents: number; discount_cents: number; total_cents: number;
  coupon_code: string | null; payment_method: Order["paymentMethod"]; payment_provider: Order["paymentProvider"]; payment_id: string | null;
  code: string; created_at: string; paid_at: string | null; picked_up_at: string | null; picked_up_by: string | null;
  canceled_at: string | null; refunded_at: string | null;
  pickup_name: string | null; pickup_cpf: string | null; pickup_phone: string | null;
  order_items: { variant_id: string; product_id: string; name: string; variant_label: string; image: string; unit_cents: number; quantity: number }[];
};

export async function getOrder(id: string): Promise<Order | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (storeMode() === "local") {
    const o = (await readLocalOrders()).find((x) => x.id === id) ?? (await recalledOrder(id));
    return o ? { ...o, code: o.code || codeFromId(o.id) } : null;
  }
  const { data } = await db().from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
  if (!data) return null;
  return fromOrderRow(data as OrderRow);
}

function fromOrderRow(r: OrderRow): Order {
  return {
    id: r.id, number: r.number, status: r.status, email: r.email, name: r.name, phone: r.phone, cpf: r.cpf, address: r.address,
    shippingMethod: r.shipping_method, shippingCents: r.shipping_cents, subtotalCents: r.subtotal_cents, discountCents: r.discount_cents,
    totalCents: r.total_cents, couponCode: r.coupon_code, paymentMethod: r.payment_method, paymentProvider: r.payment_provider,
    paymentId: r.payment_id, createdAt: r.created_at, paidAt: r.paid_at, code: r.code,
    pickupName: r.pickup_name, pickupCpf: r.pickup_cpf, pickupPhone: r.pickup_phone,
    pickedUpAt: r.picked_up_at, pickedUpBy: r.picked_up_by, canceledAt: r.canceled_at, refundedAt: r.refunded_at,
    items: r.order_items.map((i) => ({ variantId: i.variant_id, productId: i.product_id, name: i.name, variantLabel: i.variant_label, image: i.image, unitCents: i.unit_cents, quantity: i.quantity })),
  };
}

export async function setPaymentRef(id: string, paymentId: string) {
  if (storeMode() === "local") {
    await withLocalDb((d) => {
      const o = d.orders.find((x) => x.id === id);
      if (o) o.paymentId = paymentId;
    });
    return;
  }
  await db().from("orders").update({ payment_id: paymentId }).eq("id", id);
}

// Marca como pago. Se o pedido já tinha expirado, tenta reservar o estoque de novo; sem estoque, fica marcado para a equipe olhar.
export async function markOrderPaid(id: string, paymentId: string) {
  if (storeMode() === "local") {
    const fromCookie = await recalledOrder(id);
    return withLocalDb((d) => {
      // Pedido criado em outro servidor (demonstração na Vercel): entra a cópia do cookie.
      if (!d.orders.some((x) => x.id === id) && fromCookie) d.orders.push(fromCookie);
      const o = d.orders.find((x) => x.id === id);
      if (!o || o.status === "paid") return o ?? null;
      if (o.status === "canceled") for (const it of o.items) d.stock[it.variantId] = (d.stock[it.variantId] ?? 0) - it.quantity;
      o.status = "paid";
      o.paymentId = paymentId;
      o.paidAt = new Date().toISOString();
      o.canceledAt = null;
      (o.events ??= []).push({ kind: "paid", actor: o.paymentProvider === "pagarme" ? "Pagar.me" : "Pagamento simulado", at: o.paidAt });
      return o;
    });
  }
  // pay_order (0024): idempotente; registra no histórico quem confirmou o pagamento.
  const actor = paymentId.startsWith("or_") ? "Pagar.me" : paymentId.startsWith("SIM-") ? "Pagamento simulado" : "Pagamento";
  const { error } = await db().rpc("pay_order", { p_order_id: id, p_payment_id: paymentId, p_actor: actor, p_actor_id: null, p_note: null });
  if (error && !/nao_encontrado/.test(error.message)) throw error;
  return getOrder(id);
}

/** Cancela um pedido ainda aguardando pagamento (ex.: cartão recusado) e devolve as peças para a grade. */
export async function cancelPendingOrder(id: string, reason: string) {
  if (storeMode() === "local") {
    const fromCookie = await recalledOrder(id);
    return withLocalDb((d) => {
      if (!d.orders.some((x) => x.id === id) && fromCookie) d.orders.push(fromCookie);
      const o = d.orders.find((x) => x.id === id);
      if (!o || o.status !== "pending") return o ?? null;
      for (const it of o.items) d.stock[it.variantId] = (d.stock[it.variantId] ?? 0) + it.quantity;
      o.status = "canceled";
      o.canceledAt = new Date().toISOString();
      (o.events ??= []).push({ kind: "canceled", actor: "Loja", note: reason, at: o.canceledAt });
      return o;
    });
  }
  const { error } = await db().rpc("cancel_order", { p_order_id: id, p_actor: "Loja", p_actor_id: null, p_reason: reason });
  if (error && !/pedido_invalido/.test(error.message)) throw error;
  return getOrder(id);
}

/** Status que contam como "já usou o cupom" (pendente ou pago). */
const COUNTED: OrderStatus[] = ["pending", "paid", "shipped", "delivered"];

/** "Uma vez por cliente": já existe pedido pendente/pago com esse cupom e esse CPF? */
export async function couponUsedByCpf(code: string, cpf: string) {
  const c = code.toUpperCase();
  if (storeMode() === "local") return (await readLocalOrders()).some((o) => o.couponCode === c && o.cpf === cpf && COUNTED.includes(o.status));
  const { count, error } = await db().from("orders").select("id", { count: "exact", head: true }).eq("coupon_code", c).eq("cpf", cpf).in("status", COUNTED);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Meus pedidos: pedidos em que CPF e celular batem (só dígitos), do mais novo para o mais antigo. */
export async function findOrdersByCustomer(cpf: string, phone: string): Promise<Order[]> {
  if (storeMode() === "local") {
    return (await readLocalOrders())
      .filter((o) => o.cpf === cpf && o.phone === phone)
      .map((o) => ({ ...o, code: o.code || codeFromId(o.id) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30);
  }
  const { data, error } = await db().from("orders").select("*, order_items(*)").eq("cpf", cpf).eq("phone", phone).order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return (data as OrderRow[]).map(fromOrderRow);
}

export async function addNewsletter(email: string) {
  if (storeMode() === "local") {
    await withLocalDb((d) => {
      if (!d.newsletter.includes(email)) d.newsletter.push(email);
    });
    return;
  }
  await db().from("newsletter").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
}
