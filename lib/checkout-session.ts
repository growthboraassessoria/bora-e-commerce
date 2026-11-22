"use client";
// Carrinho abandonado (lado do navegador): token da sessão de compra + envio com debounce para /api/checkout-session.
import type { CartLine } from "./types";

const TOKEN = "bora-checkout-token";

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function checkoutToken(create = true): string | null {
  try {
    let t = localStorage.getItem(TOKEN);
    if (!t && create) {
      t = newToken();
      localStorage.setItem(TOKEN, t);
    }
    return t;
  } catch {
    return null;
  }
}

/** Usa o token do link de recuperação, para as próximas gravações irem para o mesmo checkout. */
export function adoptCheckoutToken(t: string) {
  try { localStorage.setItem(TOKEN, t); } catch {}
}

/** Pedido concluído: a próxima sacola começa um checkout novo. */
export function resetCheckoutToken() {
  try { localStorage.removeItem(TOKEN); } catch {}
}

function readJson(key: string) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

export type CheckoutSync = {
  step: "cart" | "contact" | "pickup" | "payment";
  lines: CartLine[];
  coupon?: string;
  method?: "pix" | "card";
  contact?: { name?: string; email?: string; phone?: string; cpf?: string };
};

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: CheckoutSync | null = null;
let last = "";

async function send(p: CheckoutSync) {
  const token = checkoutToken(p.lines.length > 0);
  if (!token) return;
  const vid = (() => { try { return localStorage.getItem("bora-vid") || undefined; } catch { return undefined; } })();
  const utmRaw = readJson("bora-utm");
  const utm = utmRaw && typeof utmRaw === "object" ? Object.fromEntries(Object.entries(utmRaw).filter(([, v]) => typeof v === "string").map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)])) : undefined;
  const body = JSON.stringify({ token, ...p, coupon: p.coupon || undefined, visitorId: vid, utm });
  if (body === last) return;
  last = body;
  try {
    const res = await fetch("/api/checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      // Esse checkout já virou pedido: começa outro e reenvia.
      if (data?.completed) {
        resetCheckoutToken();
        last = "";
        if (p.lines.length) void send(p);
      }
    }
  } catch {
    last = "";
  }
}

const STEPS = ["cart", "contact", "pickup", "payment"] as const;

/** Agenda a gravação (debounce). Etapas do checkout passam `now` para não esperar. */
export function syncCheckout(p: CheckoutSync, now = false) {
  if (typeof window === "undefined") return;
  // Junta com o que ainda não foi enviado: a etapa não volta e o contato não se perde.
  pending = pending
    ? {
        ...p,
        step: STEPS.indexOf(p.step) >= STEPS.indexOf(pending.step) ? p.step : pending.step,
        contact: { ...pending.contact, ...p.contact },
        method: p.method ?? pending.method,
      }
    : p;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const next = pending;
    pending = null;
    if (next) void send(next);
  }, now ? 0 : 1500);
}

/** Avisa o servidor que o link de recuperação foi aberto. */
export function markCheckoutRecovered(token: string) {
  void fetch("/api/checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, recovered: true }) }).catch(() => {});
}
