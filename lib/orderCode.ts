// ID legível do pedido: BR- + 6 caracteres sem 0/O/1/I (fácil de ditar no balcão). Mesmo formato da função loja.new_order_code().
import { randomInt, createHash } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newOrderCode(taken: Set<string> = new Set()): string {
  for (;;) {
    let s = "BR-";
    for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    if (!taken.has(s)) return s;
  }
}

/** Pedidos locais antigos, criados antes do ID: código fixo derivado do id (o BORA OS calcula igual). */
export function codeFromId(id: string): string {
  const h = createHash("sha256").update(id).digest();
  let s = "BR-";
  for (let i = 0; i < 6; i++) s += ALPHABET[h[i] % ALPHABET.length];
  return s;
}
