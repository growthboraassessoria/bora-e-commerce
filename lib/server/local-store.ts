import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Coupon, Order } from "../types";

// Modo local (sem Supabase): pedidos e estoque num arquivo. Serve para desenvolver e para a demonstração.
// Na Vercel só o /tmp aceita gravação (e cada servidor tem o seu): ver lib/server/order-cookie.ts.
const DIR = process.env.VERCEL ? "/tmp/bora-store" : path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "loja.json");

/** Carrinho abandonado (espelho de loja.checkouts). */
export type LocalCheckout = {
  id: string; token: string; visitorId: string | null;
  email: string | null; phone: string | null; name: string | null; cpf: string | null;
  lines: CheckoutLine[]; itemCount: number; subtotalCents: number; totalCents: number; couponCode: string | null;
  step: "cart" | "contact" | "pickup" | "payment"; paymentMethod: string | null; orderId: string | null;
  completedAt: string | null; recoveredAt: string | null; utm: Record<string, string>; createdAt: string; updatedAt: string;
};
export type CheckoutLine = { variantId: string; quantity: number; name: string; variantLabel: string; unitCents: number; image: string };

/** Espelho de loja.settings (porta da loja). Sem isso a loja fica aberta. */
export type LocalSettings = { status?: "open" | "password"; passwordHash?: string | null; passwordVersion?: number; passwordMessage?: string };

// coupons: descontos gravados pelo BORA OS no modo local (espelho de loja.coupons). Sem a chave, valem os do catálogo (lib/catalog-seed.ts).
type LocalDb = { stock: Record<string, number>; orders: Order[]; newsletter: string[]; seq: number; checkouts?: LocalCheckout[]; settings?: LocalSettings; coupons?: Coupon[] };

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<LocalDb> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { stock: {}, orders: [], newsletter: [], seq: 1000 };
  }
}

// Arquivo que ainda não existe = banco vazio. Arquivo ilegível = erro (nunca grava por cima e apaga os pedidos).
function loadSync(): LocalDb {
  let raw: string;
  try {
    raw = readFileSync(FILE, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { stock: {}, orders: [], newsletter: [], seq: 1000 };
    throw e;
  }
  return JSON.parse(raw) as LocalDb;
}

// Uma escrita por vez, para o estoque não ficar negativo com dois pedidos simultâneos.
// Ler, alterar e gravar acontece sem pausa (síncrono) quando fn é síncrona: assim rotas e server actions,
// que podem ter cópias diferentes deste módulo no mesmo servidor, não apagam a gravação uma da outra.
export function withLocalDb<T>(fn: (db: LocalDb) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const data = loadSync();
    const out = fn(data);
    const result = out instanceof Promise ? await out : out;
    mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function readLocalStock() {
  return (await load()).stock;
}

export async function readLocalOrders() {
  return (await load()).orders;
}

export async function readLocalCheckouts() {
  return (await load()).checkouts ?? [];
}

/** Descontos que o BORA OS gravou no arquivo (null = o OS ainda não gravou nenhum: valem os do catálogo). Lido a cada pedido, sem cache. */
export async function readLocalCoupons(): Promise<Coupon[] | null> {
  const c = (await load()).coupons;
  return Array.isArray(c) ? c : null;
}
