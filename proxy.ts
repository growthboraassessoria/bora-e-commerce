// Porta da loja na frente de todas as rotas (Next 16: proxy = antigo middleware, roda em Node.js).
// Com a loja em "senha" e sem o cookie de acesso: páginas mostram a tela de senha (/senha, mantendo o endereço)
// e /api/* responde 403. Webhooks, pós-compra e a própria tela de senha ficam de fora (GATE_EXEMPT).
// O StoreGate (layout) confere de novo; as server actions conferem por conta própria (placeOrder etc.).
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, checkAccessToken, isGateExempt, loadStoreSettings, type StoreSettings } from "@/lib/server/settings-core";

let cached: { at: number; s: StoreSettings } | null = null;
async function settings() {
  if (cached && Date.now() - cached.at < 15_000) return cached.s;
  const s = await loadStoreSettings();
  cached = { at: Date.now(), s };
  return s;
}

// Domínio oficial. O endereço antigo da Vercel manda para ele (páginas e GET), menos /api: o webhook da Pagar.me
// ainda pode estar apontando para o endereço antigo e não segue redirecionamento.
const OFFICIAL_HOST = "loja.boraassessoria.com";
const LEGACY_HOSTS = new Set(["borausar.vercel.app"]);

export async function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (LEGACY_HOSTS.has(host) && req.method === "GET" && !req.nextUrl.pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.host = OFFICIAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  // O cabeçalho de liberação só pode vir daqui, nunca do navegador.
  const h = new Headers(req.headers);
  h.delete("x-bora-gate");
  const pass = () => NextResponse.next({ request: { headers: h } });

  // Server actions conferem a porta por conta própria (e a tela de senha usa uma).
  if (req.headers.get("next-action")) return pass();

  const { pathname } = req.nextUrl;
  if (isGateExempt(pathname)) {
    h.set("x-bora-gate", "exempt");
    return pass();
  }
  const s = await settings();
  if (s.status !== "password") return pass();
  if (checkAccessToken(req.cookies.get(ACCESS_COOKIE)?.value, s.passwordVersion)) return pass();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "A loja está fechada no momento." }, { status: 403 });
  const url = req.nextUrl.clone();
  url.pathname = "/senha";
  url.search = "";
  return NextResponse.rewrite(url, { request: { headers: h } });
}

export const config = {
  // Tudo menos arquivos do Next, imagens/fontes públicas e arquivos com extensão (robots.txt, sitemap.xml...).
  matcher: ["/((?!_next/static|_next/image|img/|fonts/|favicon|.*\\.[a-zA-Z0-9]+$).*)"],
};
