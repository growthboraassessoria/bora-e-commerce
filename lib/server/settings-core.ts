// Porta da loja (loja.settings): leitura e conferência do acesso.
// Sem "server-only" e sem o cliente do Supabase porque também roda no proxy.ts; só importar em código de servidor.
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_RULES, normalizeRules, type PaymentRules } from "../payment-rules";

export type StoreSettings = {
  status: "open" | "password";
  passwordHash: string | null;
  passwordVersion: number;
  passwordMessage: string;
};

export const ACCESS_COOKIE = "bora_store_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias
export const DEFAULT_MESSAGE = "A BORA Store abre em breve. Tem a senha? Entre abaixo.";
export const OPEN: StoreSettings = { status: "open", passwordHash: null, passwordVersion: 1, passwordMessage: DEFAULT_MESSAGE };

/**
 * Caminhos que nunca passam pela porta: webhooks de pagamento, aviso de conteúdo do OS (assinado),
 * páginas de pós-compra (link assinado ou CPF + celular) e a própria tela de senha.
 * A coleta de analytics também fica livre para medir a tela de senha.
 */
export const GATE_EXEMPT = [
  "/api/webhooks", "/api/revalidate", "/api/t", "/api/pagamento/status", "/obrigado", "/pagamento", "/meus-pedidos", "/senha",
  "/sitemap.xml", "/robots.txt", "/manifest.webmanifest", "/opengraph-image",
];
// Imagens de compartilhamento geradas por rota (ex.: /produto/<slug>/opengraph-image-xyz).
const OG_IMAGE = /^\/produto\/[^/]+\/opengraph-image[^/]*$/;
export const isGateExempt = (pathname: string) =>
  OG_IMAGE.test(pathname) || GATE_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/") || (p === "/opengraph-image" && pathname.startsWith(p)));

const supabaseOn = () => process.env.DATA_STORE !== "local" && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_FILE = path.join(process.env.VERCEL ? "/tmp/bora-store" : path.join(process.cwd(), ".data"), "loja.json");

function normalize(r: { status?: string | null; password_hash?: string | null; password_version?: number | null; password_message?: string | null } | null | undefined): StoreSettings {
  if (!r) return OPEN;
  return {
    status: r.status === "password" ? "password" : "open",
    passwordHash: r.password_hash ?? null,
    passwordVersion: Number(r.password_version) || 1,
    passwordMessage: r.password_message?.trim() || DEFAULT_MESSAGE,
  };
}

/** Lê as configurações sem cache. Erro de leitura = loja aberta (é o padrão da tabela), com aviso no log. */
export async function loadStoreSettings(): Promise<StoreSettings> {
  try {
    if (!supabaseOn()) {
      const raw = JSON.parse(await readFile(LOCAL_FILE, "utf8").catch(() => "{}"));
      const s = raw?.settings;
      return normalize(s ? { status: s.status, password_hash: s.passwordHash, password_version: s.passwordVersion, password_message: s.passwordMessage } : null);
    }
    const url = `${process.env.SUPABASE_URL}/rest/v1/settings?select=status,password_hash,password_version,password_message&id=eq.true`;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "loja" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`settings ${res.status}`);
    const rows = (await res.json()) as Parameters<typeof normalize>[0][];
    return normalize(rows[0]);
  } catch (e) {
    console.error("loja.settings", (e as Error).message);
    return OPEN;
  }
}

const secret = () => process.env.ORDER_LINK_SECRET || "dev-only-secret";

/** Valor do cookie de acesso. Muda quando a senha muda (password_version), o que derruba os acessos antigos. */
export function accessToken(version: number) {
  return createHmac("sha256", secret()).update(`access:${version}`).digest("base64url");
}

export function checkAccessToken(value: string | undefined | null, version: number) {
  if (!value) return false;
  const a = Buffer.from(accessToken(version));
  const b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Confere a senha com o hash do OS: "scrypt$<salt hex>$<hash hex>" (N=16384, r=8, p=1, 32 bytes). */
export function verifyPassword(password: string, stored: string | null) {
  if (!stored || !password) return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  try {
    const want = Buffer.from(hash, "hex");
    const got = scryptSync(password, Buffer.from(salt, "hex"), want.length || 32, { N: 16384, r: 8, p: 1 });
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}

/** Regras de pagamento (loja.settings.payment, definidas no BORA OS). Sem a coluna ou com erro: regras padrão. */
export async function loadPaymentRules(): Promise<PaymentRules> {
  try {
    if (!supabaseOn()) {
      const raw = JSON.parse(await readFile(LOCAL_FILE, "utf8").catch(() => "{}"));
      return normalizeRules(raw?.settings?.payment);
    }
    const url = `${process.env.SUPABASE_URL}/rest/v1/settings?select=payment&id=eq.true`;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "loja" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`settings.payment ${res.status}`);
    const rows = (await res.json()) as { payment?: unknown }[];
    return normalizeRules(rows[0]?.payment);
  } catch (e) {
    console.error("loja.settings.payment", (e as Error).message);
    return DEFAULT_RULES;
  }
}
