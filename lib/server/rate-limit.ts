import "server-only";
import { headers } from "next/headers";

// Limite simples de tentativas, em memória (por servidor). Serve para frear força bruta, não é um WAF.
const buckets = new Map<string, { count: number; reset: number }>();

/** Conta uma tentativa. Devolve false quando passou do limite na janela. */
export function hit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim().slice(0, 64);
}

/** Espera até completar `ms` desde `startedAt` (resposta com tempo mínimo, para não dar pista pelo tempo). */
export async function minDelay(startedAt: number, ms: number) {
  const left = ms - (Date.now() - startedAt);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
}
