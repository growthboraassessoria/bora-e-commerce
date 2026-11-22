"use client";
import { useSyncExternalStore } from "react";
import type { CartLine } from "./types";
import { track } from "./analytics";
import { syncCheckout } from "./checkout-session";

// Carrinho no navegador (localStorage). O servidor sempre recalcula preço e estoque a partir das variantes.
const KEY = "bora-cart-v1";
type State = { lines: CartLine[]; open: boolean; coupon: string };
const EMPTY: State = { lines: [], open: false, coupon: "" };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...EMPTY, lines: Array.isArray(parsed.lines) ? parsed.lines : [], coupon: typeof parsed.coupon === "string" ? parsed.coupon : "" };
    }
  } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    emit();
  });
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ lines: state.lines, coupon: state.coupon }));
  } catch {}
}

function emit() {
  for (const l of listeners) l();
}

function set(next: Partial<State>, persist = true) {
  const before = state;
  state = { ...state, ...next };
  if (persist) save();
  emit();
  // Carrinho abandonado: grava a sacola (sem dados pessoais) quando itens ou cupom mudam.
  if (persist && (before.lines !== state.lines || before.coupon !== state.coupon)) syncCheckout({ step: "cart", lines: state.lines, coupon: state.coupon });
}

/** Dados da peça para o analytics (add_to_cart / remove_from_cart). Nunca dados pessoais. */
export type CartItemInfo = { itemId: string; name?: string; size?: string; priceCents?: number };

function trackQty(kind: "add_to_cart" | "remove_from_cart", variantId: string, quantity: number, info?: CartItemInfo) {
  if (quantity <= 0) return;
  const price = info?.priceCents != null ? info.priceCents / 100 : undefined;
  track(kind, {
    item_id: info?.itemId, variant_id: variantId, size: info?.size, quantity,
    value: price != null ? price * quantity : undefined, currency: "BRL",
    items: [{ item_id: info?.itemId ?? variantId, item_name: info?.name, item_variant: info?.size, price, quantity }],
  });
}

export const cart = {
  add(variantId: string, quantity = 1, openDrawer = true, info?: CartItemInfo) {
    load();
    const lines = [...state.lines];
    const i = lines.findIndex((l) => l.variantId === variantId);
    const had = i >= 0 ? lines[i].quantity : 0;
    if (i >= 0) lines[i] = { ...lines[i], quantity: Math.min(10, lines[i].quantity + quantity) };
    else lines.push({ variantId, quantity: Math.min(10, quantity) });
    set({ lines, open: openDrawer });
    trackQty("add_to_cart", variantId, Math.min(10, had + quantity) - had, info);
  },
  setQty(variantId: string, quantity: number, info?: CartItemInfo) {
    load();
    const had = state.lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
    const q = Math.max(0, Math.min(10, quantity));
    const lines = state.lines
      .map((l) => (l.variantId === variantId ? { ...l, quantity: q } : l))
      .filter((l) => l.quantity > 0);
    set({ lines });
    if (q > had) trackQty("add_to_cart", variantId, q - had, info);
    else trackQty("remove_from_cart", variantId, had - q, info);
  },
  remove(variantId: string, info?: CartItemInfo) {
    load();
    const had = state.lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
    set({ lines: state.lines.filter((l) => l.variantId !== variantId) });
    trackQty("remove_from_cart", variantId, had, info);
  },
  /** Recuperação de carrinho: troca a sacola inteira pelas linhas do link. */
  replace(lines: CartLine[], coupon?: string) {
    load();
    set({ lines: lines.slice(0, 30).map((l) => ({ variantId: l.variantId, quantity: Math.max(1, Math.min(10, l.quantity)) })), coupon: (coupon ?? state.coupon).trim().toUpperCase() });
  },
  clear() {
    set({ lines: [], coupon: "" });
  },
  setCoupon(coupon: string) {
    set({ coupon: coupon.trim().toUpperCase() });
  },
  open() {
    set({ open: true }, false);
  },
  close() {
    set({ open: false }, false);
  },
};

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCart() {
  return useSyncExternalStore(
    subscribe,
    () => (load(), state),
    () => EMPTY,
  );
}

export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
