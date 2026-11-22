import "server-only";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, checkAccessToken, loadPaymentRules, loadStoreSettings, type StoreSettings } from "./settings-core";

export type { StoreSettings };
export const SETTINGS_TAG = "loja-settings";

/** Configurações da loja com cache curto (15 s). O OS pode limpar na hora com revalidateTag("loja-settings"). */
export const getStoreSettings = unstable_cache(loadStoreSettings, ["loja-settings-v1"], { revalidate: 15, tags: [SETTINGS_TAG] });

/** Regras de pagamento do BORA OS (Pix, cartão, parcelas), com o mesmo cache curto. */
export const getPaymentRules = unstable_cache(loadPaymentRules, ["loja-payment-v1"], { revalidate: 15, tags: [SETTINGS_TAG] });

/** O visitante tem o cookie de acesso válido para a senha atual? */
export async function hasStoreAccess(s: StoreSettings) {
  if (s.status !== "password") return true;
  return checkAccessToken((await cookies()).get(ACCESS_COOKIE)?.value, s.passwordVersion);
}

/** true quando a loja está com senha e este visitante ainda não entrou (usar em rotas e server actions). */
export async function storeLocked() {
  const s = await getStoreSettings();
  if (s.status !== "password") return false;
  return !(await hasStoreAccess(s));
}

/** Resposta padrão das rotas /api quando a loja está fechada para este visitante. */
export async function lockedResponse() {
  return (await storeLocked()) ? Response.json({ error: "A loja está fechada no momento." }, { status: 403 }) : null;
}
