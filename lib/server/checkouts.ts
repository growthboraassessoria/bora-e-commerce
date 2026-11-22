import "server-only";
import { randomUUID } from "node:crypto";
import { db, storeMode } from "./db";
import { readLocalCheckouts, withLocalDb, type CheckoutLine, type LocalCheckout } from "./local-store";

// Carrinho abandonado (loja.checkouts). Uma linha por sessão de compra, achada pelo token secreto do navegador.
// Nada aqui devolve dados de um checkout para quem não tem o token.

export type CheckoutStep = LocalCheckout["step"];
const ORDER: CheckoutStep[] = ["cart", "contact", "pickup", "payment"];
const maxStep = (a: CheckoutStep, b: CheckoutStep) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a);

export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export type CheckoutPatch = {
  step: CheckoutStep;
  lines: CheckoutLine[];
  itemCount: number;
  subtotalCents: number;
  totalCents: number;
  couponCode: string | null;
  visitorId?: string | null;
  utm?: Record<string, string>;
  contact?: { name?: string; email?: string; phone?: string; cpf?: string };
  paymentMethod?: string | null;
};

type Row = { id: string; step: CheckoutStep; completed_at: string | null };

/** Grava ou atualiza o checkout do token. A etapa nunca volta (cart → contact → pickup → payment). */
export async function saveCheckout(token: string, p: CheckoutPatch): Promise<{ ok: boolean; completed?: boolean }> {
  const now = new Date().toISOString();
  const contact = Object.fromEntries(Object.entries(p.contact ?? {}).filter(([, v]) => v)) as NonNullable<CheckoutPatch["contact"]>;

  if (storeMode() === "local") {
    return withLocalDb((d) => {
      const list = (d.checkouts ??= []);
      let c = list.find((x) => x.token === token);
      if (c?.completedAt) return { ok: true, completed: true };
      if (!c) {
        if (!p.itemCount) return { ok: true };
        c = {
          id: randomUUID(), token, visitorId: null, email: null, phone: null, name: null, cpf: null, lines: [], itemCount: 0,
          subtotalCents: 0, totalCents: 0, couponCode: null, step: "cart", paymentMethod: null, orderId: null,
          completedAt: null, recoveredAt: null, utm: {}, createdAt: now, updatedAt: now,
        };
        list.push(c);
        if (list.length > 2000) list.splice(0, list.length - 2000);
      }
      Object.assign(c, {
        lines: p.lines, itemCount: p.itemCount, subtotalCents: p.subtotalCents, totalCents: p.totalCents, couponCode: p.couponCode,
        step: maxStep(c.step, p.step), updatedAt: now,
        ...(p.visitorId ? { visitorId: p.visitorId } : {}),
        ...(p.utm && Object.keys(p.utm).length && !Object.keys(c.utm).length ? { utm: p.utm } : {}),
        ...(p.paymentMethod ? { paymentMethod: p.paymentMethod } : {}),
        ...contact,
      });
      return { ok: true };
    });
  }

  const { data: found, error: readErr } = await db().from("checkouts").select("id, step, completed_at").eq("token", token).maybeSingle();
  if (readErr) throw readErr;
  const row = found as Row | null;
  if (row?.completed_at) return { ok: true, completed: true };
  if (!row && !p.itemCount) return { ok: true };
  const fields: Record<string, unknown> = {
    lines: p.lines, item_count: p.itemCount, subtotal_cents: p.subtotalCents, total_cents: p.totalCents, coupon_code: p.couponCode,
    step: row ? maxStep(row.step, p.step) : p.step, updated_at: now,
  };
  if (p.visitorId) fields.visitor_id = p.visitorId;
  if (p.paymentMethod) fields.payment_method = p.paymentMethod;
  for (const k of ["name", "email", "phone", "cpf"] as const) if (contact[k]) fields[k] = contact[k];
  if (row) {
    const { error } = await db().from("checkouts").update(fields).eq("id", row.id).is("completed_at", null);
    if (error) throw error;
    return { ok: true };
  }
  const { error } = await db().from("checkouts").insert({ token, ...fields, utm: p.utm ?? {} });
  if (error) {
    // Duas abas gravando ao mesmo tempo: a outra já criou, então só atualiza.
    if (error.code === "23505") {
      const { error: e2 } = await db().from("checkouts").update(fields).eq("token", token).is("completed_at", null);
      if (e2) throw e2;
      return { ok: true };
    }
    throw error;
  }
  return { ok: true };
}

export type RecoveredCheckout = {
  lines: { variantId: string; quantity: number }[];
  couponCode: string | null;
  name: string; email: string; phone: string;
  completed: boolean;
};

/** Link de recuperação (/checkout?recuperar=<token>): devolve a sacola e o contato (nunca o CPF). */
export async function getCheckoutForRecovery(token: string): Promise<RecoveredCheckout | null> {
  if (!TOKEN_RE.test(token)) return null;
  type R = { lines: CheckoutLine[] | null; coupon_code: string | null; name: string | null; email: string | null; phone: string | null; completed_at: string | null };
  let r: R | null = null;
  if (storeMode() === "local") {
    const c = (await readLocalCheckouts()).find((x) => x.token === token);
    if (c) r = { lines: c.lines, coupon_code: c.couponCode, name: c.name, email: c.email, phone: c.phone, completed_at: c.completedAt };
  } else {
    const { data, error } = await db().from("checkouts").select("lines, coupon_code, name, email, phone, completed_at").eq("token", token).maybeSingle();
    if (error) throw error;
    r = data as R | null;
  }
  if (!r) return null;
  return {
    lines: (Array.isArray(r.lines) ? r.lines : [])
      .filter((l) => typeof l?.variantId === "string" && Number(l.quantity) > 0)
      .slice(0, 30)
      .map((l) => ({ variantId: l.variantId, quantity: Math.min(10, Math.floor(Number(l.quantity))) })),
    couponCode: r.coupon_code, name: r.name ?? "", email: r.email ?? "", phone: r.phone ?? "", completed: !!r.completed_at,
  };
}

/** Marca que o link de recuperação foi aberto (só a primeira vez). */
export async function markRecovered(token: string) {
  const now = new Date().toISOString();
  if (storeMode() === "local") {
    await withLocalDb((d) => {
      const c = d.checkouts?.find((x) => x.token === token);
      if (c && !c.recoveredAt && !c.completedAt) c.recoveredAt = now;
    });
    return;
  }
  const { error } = await db().from("checkouts").update({ recovered_at: now }).eq("token", token).is("recovered_at", null).is("completed_at", null);
  if (error) throw error;
}

/** Pedido criado: o checkout do token vira "concluído" e aponta para o pedido. */
export async function completeCheckout(token: string, orderId: string, contact: { name: string; email: string; phone: string; cpf: string }, paymentMethod: string) {
  if (!TOKEN_RE.test(token)) return;
  const now = new Date().toISOString();
  if (storeMode() === "local") {
    await withLocalDb((d) => {
      const c = d.checkouts?.find((x) => x.token === token);
      if (!c || c.completedAt) return;
      Object.assign(c, { completedAt: now, orderId, step: "payment", paymentMethod, updatedAt: now, ...contact });
    });
    return;
  }
  const { error } = await db().from("checkouts")
    .update({ completed_at: now, order_id: orderId, step: "payment", payment_method: paymentMethod, updated_at: now, ...contact })
    .eq("token", token).is("completed_at", null);
  if (error) throw error;
}
