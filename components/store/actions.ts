"use server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, loadStoreSettings, verifyPassword } from "@/lib/server/settings-core";
import { clientIp, hit, minDelay } from "@/lib/server/rate-limit";

export type UnlockState = { ok: boolean; error: string | null; reason?: "ok" | "vazia" | "incorreta" | "limite" | "aberta" };

// Confere a senha da loja. Sempre leva pelo menos ~0,9 s e tem limite por IP, para dificultar força bruta.
export async function unlockStore(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const started = Date.now();
  // Tira espaços e caracteres invisíveis (teclado do celular, copiar e colar do WhatsApp).
  const password = String(form.get("senha") ?? "").normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]/g, "").slice(0, 200);
  if (!hit(`senha:${await clientIp()}`, 15, 10 * 60_000)) {
    await minDelay(started, 900);
    console.warn("store_unlock", JSON.stringify({ result: "limite" }));
    return { ok: false, error: "Muitas tentativas. Espere alguns minutos e tente de novo.", reason: "limite" };
  }
  const s = await loadStoreSettings(); // sem cache: a senha acabou de ser trocada no OS? vale a nova.
  if (s.status !== "password") return { ok: true, error: null, reason: "aberta" };
  const ok = verifyPassword(password, s.passwordHash);
  await minDelay(started, 900);
  // Diagnóstico sem a senha: só o tamanho e se é só número.
  console.log("store_unlock", JSON.stringify({ result: ok ? "ok" : password ? "incorreta" : "vazia", len: password.length, digits: /^\d+$/.test(password), version: s.passwordVersion, hash: !!s.passwordHash }));
  if (!ok) return { ok: false, error: password ? "Senha incorreta." : "Digite a senha.", reason: password ? "incorreta" : "vazia" };
  (await cookies()).set(ACCESS_COOKIE, accessToken(s.passwordVersion), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ACCESS_MAX_AGE,
  });
  return { ok: true, error: null, reason: "ok" };
}
