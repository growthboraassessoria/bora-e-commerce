import "server-only";
// Cópia do último pedido num cookie criptografado (só no modo local/demonstração).
// Na Vercel cada servidor tem o próprio /tmp: se a página de pagamento ou de obrigado cair em outro servidor,
// o pedido vem daqui. Criptografado com AES-256-GCM (chave derivada do ORDER_LINK_SECRET); só o servidor lê.
import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Order } from "../types";

const NAME = "bora_order";
const key = () => createHash("sha256").update(`order-cookie:${process.env.ORDER_LINK_SECRET || "dev-only-secret"}`).digest();

function seal(o: Order) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(o), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

function unseal(raw: string): Order | null {
  try {
    const b = Buffer.from(raw, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8")) as Order;
  } catch {
    return null;
  }
}

/** Só em server actions (é onde dá para gravar cookie). */
export async function rememberOrder(o: Order) {
  (await cookies()).set(NAME, seal(o), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function recalledOrder(id: string): Promise<Order | null> {
  try {
    const raw = (await cookies()).get(NAME)?.value;
    const o = raw ? unseal(raw) : null;
    return o && o.id === id ? o : null;
  } catch {
    return null;
  }
}
