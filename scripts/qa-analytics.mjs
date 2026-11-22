// Teste do analytics próprio e do SEO no servidor de desenvolvimento (modo local, grava em .data/events.jsonl).
// Uso: node scripts/qa-analytics.mjs [base]   (padrão http://localhost:3500)
// Navega como uma pessoa (com UTM de teste), rola, clica, busca, abre 404 e a experiência 3D,
// e confere: eventos chegaram com visitor_id/session_id, UTM nas colunas, sem e-mail/CPF/telefone,
// JSON-LD válido nas páginas, um h1 por página, /sitemap.xml e /robots.txt.
// Os eventos de teste ficam com utm_source "qa" (fácil de filtrar). Nunca rode contra produção.
import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:3500";
if (!/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error("Este teste só roda contra o servidor local (modo local). Base recebida:", BASE);
  process.exit(1);
}
const FILE = path.join(process.cwd(), ".data", "events.jsonl");
const offset = existsSync(FILE) ? statSync(FILE).size : 0;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const warns = [];
const ok = (cond, msg, warnOnly = false) => { if (!cond) (warnOnly ? warns : fails).push(msg); };

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  // User agent de navegador comum também na linha de comando: os envios feitos ao sair da página (sendBeacon)
  // usam o do navegador, não o da aba, e "HeadlessChrome" é descartado como robô.
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", `--user-agent=${UA}`],
});
const page = await browser.newPage();
await page.setUserAgent(UA);
await page.setViewport({ width: 1280, height: 860 });
// O coletor ignora navegadores automatizados (navigator.webdriver); aqui fingimos ser um navegador comum.
await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
const pageErrors = [];
page.on("pageerror", (e) => { if (!/qa erro de teste/.test(e.message)) pageErrors.push(e.message); });

const h1s = {};
async function countH1(name) { h1s[name] = await page.$$eval("h1", (els) => els.length); }
async function scrollAll() {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await sleep(400);
}

// 1) Home com campanha, rolagem e clique num link interno (navegação do App Router).
await page.goto(`${BASE}/?utm_source=qa&utm_medium=teste&utm_campaign=analytics&gclid=qa-gclid`, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(1200);
await countH1("home");
await scrollAll();
await page.evaluate(() => window.scrollTo(0, 0));
await page.evaluate(() => document.querySelector('main a[href="/volta-18k"]')?.click());
await page.waitForFunction(() => location.pathname === "/volta-18k", { timeout: 20000 });
await sleep(1800);
await countH1("volta-18k");
await scrollAll();
// FAQ (summary = botão) e rage click no mesmo ponto.
await page.evaluate(() => document.querySelector("details summary")?.scrollIntoView({ block: "center" }));
await sleep(300);
const sum = await page.$("details summary");
if (sum) { const b = await sum.boundingBox(); for (let i = 0; i < 4; i++) await page.mouse.click(b.x + 10, b.y + 10, { delay: 10 }); }
await sleep(300);

// 2) Elementos de teste: data-track, link de saída, download e um erro de JS com e-mail na mensagem.
await page.evaluate(() => {
  const box = document.createElement("div");
  box.innerHTML = `<button id="qa-dt" data-track="qa_botao" data-track-local="teste" data-track-email="alex@exemplo.com">QA</button>
    <a id="qa-out" href="https://example.com/caminho?x=1">Site externo</a>
    <a id="qa-file" href="/arquivos/tabela-medidas.pdf">Baixar PDF</a>`;
  document.body.appendChild(box);
  box.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));
});
await page.click("#qa-dt");
await page.click("#qa-out");
await page.click("#qa-file");
// Erro num script da própria página (erros de page.evaluate chegam como "Script error." e são ignorados).
await page.evaluate(() => {
  const s = document.createElement("script");
  s.textContent = 'setTimeout(function () { throw new Error("qa erro de teste alex@exemplo.com cpf 123.456.789-09"); }, 0);';
  document.body.appendChild(s);
});
await sleep(500);

// 3) Busca: digitar e enviar o formulário.
await page.goto(`${BASE}/busca`, { waitUntil: "networkidle2" });
await sleep(800);
await page.type('form[role=search] input[name=q]', "camiseta");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null), page.keyboard.press("Enter")]);
await sleep(1200);
await countH1("busca");

// 4) Produto, coleção, política (botão de desligar a medição), 404.
for (const [name, p] of [["produto", "/produto/camiseta-letz-bora-algodao"], ["colecao", "/colecao/todos"], ["politica", "/politicas/privacidade"], ["404", "/pagina-que-nao-existe-qa"]]) {
  await page.goto(BASE + p, { waitUntil: "networkidle2" });
  await sleep(900);
  await countH1(name);
  if (name === "politica") ok(await page.$$eval("button", (bs) => bs.some((b) => /Desligar a medição/.test(b.textContent || ""))), "política: botão para desligar a medição não apareceu");
}

// 5) Experiência 3D: espera a cena e rola até a chegada.
await page.goto(`${BASE}/experiencia`, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(4000);
await countH1("experiencia");
await scrollAll();
await sleep(800);

// 6) Aba escondida: manda user_engagement, web vitals e esvazia a fila (sendBeacon). Depois fecha.
await page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
await sleep(800);
await page.close();
await sleep(1500);

// ---------- conferência dos eventos ----------
const raw = existsSync(FILE) ? readFileSync(FILE).subarray(offset).toString("utf8") : "";
const events = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
const mine = events.filter((e) => e.utm_source === "qa");
ok(events.length > 0, "nenhum evento chegou em .data/events.jsonl (o servidor está no modo local?)");
ok(mine.length > 0, "nenhum evento com utm_source=qa");
const visitors = new Set(mine.map((e) => e.visitor_id));
ok(visitors.size === 1, `esperava 1 visitor_id, veio ${visitors.size}`);
ok(mine.every((e) => e.visitor_id && e.session_id), "evento sem visitor_id ou session_id");
ok(mine.every((e) => e.utm_medium === "teste" && e.utm_campaign === "analytics"), "UTM faltando nas colunas");
ok(mine.every((e) => e.device && e.browser && e.os), "device/browser/os faltando nas colunas");
const names = new Set(mine.map((e) => e.name));
const need = ["first_visit", "session_start", "page_view", "scroll", "ui_click", "user_engagement", "form_start", "form_submit", "view_search_results", "page_not_found", "click", "file_download", "qa_botao", "rage_click", "js_error", "web_vitals", "first_interaction", "visibility"];
for (const n of need) ok(names.has(n), `evento ${n} não chegou`);
ok(names.has("experiencia_3d_start"), "experiencia_3d_start não chegou (WebGL no Chrome sem tela?)", true);
ok(names.has("experiencia_3d_progress"), "experiencia_3d_progress não chegou", true);
const pv = mine.filter((e) => e.name === "page_view");
ok(pv.some((e) => e.path === "/volta-18k" && e.referrer === "/?utm_source=qa&utm_medium=teste&utm_campaign=analytics&gclid=qa-gclid"), "page_view da navegação interna sem referrer da página anterior");
ok(pv.every((e) => e.title), "page_view sem título");
const ss = mine.find((e) => e.name === "session_start");
ok(ss?.props?.gclid === "qa-gclid", "session_start sem gclid");
const ue = mine.filter((e) => e.name === "user_engagement");
ok(ue.every((e) => typeof e.props.engagement_time_msec === "number" && e.props.engagement_time_msec > 0), "user_engagement sem engagement_time_msec numérico");
const wv = mine.filter((e) => e.name === "web_vitals");
ok(wv.every((e) => typeof e.props.name === "string" && typeof e.props.value === "number"), "web_vitals sem props.name/props.value");
ok(wv.some((e) => e.props.name === "TTFB") && wv.some((e) => e.props.name === "FCP"), "web vitals TTFB/FCP faltando");
const sr = mine.find((e) => e.name === "view_search_results");
ok(sr?.props?.search_term === "camiseta" && typeof sr?.props?.results === "number", "view_search_results sem termo ou contagem");
const err = mine.find((e) => e.name === "js_error");
ok(err && /\[removido\]/.test(err.props.message) && !/@|123\.456/.test(err.props.message), "js_error não limpou e-mail/CPF da mensagem");
const dt = mine.find((e) => e.name === "qa_botao");
ok(dt?.props?.local === "teste" && !("email" in (dt?.props ?? {})), "data-track: props erradas ou e-mail não removido");
// Nada de dados pessoais em lugar nenhum.
const PII = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\(\d{2}\)\s?9?\d{4}-\d{4}/i;
const leaks = mine.filter((e) => PII.test(JSON.stringify(e)));
ok(leaks.length === 0, `dado pessoal em ${leaks.length} evento(s): ${leaks.slice(0, 2).map((e) => e.name).join(", ")}`);
// Um h1 por página.
for (const [n, c] of Object.entries(h1s)) ok(c === 1, `${n}: ${c} h1 (esperado 1)`);
ok(pageErrors.length === 0, `erros na página: ${pageErrors.slice(0, 3).join(" | ")}`);
await browser.close();

// ---------- SEO: JSON-LD, sitemap e robots ----------
const LD = {
  "/": ["Organization", "WebSite"],
  "/produto/camiseta-letz-bora-algodao": ["Product", "BreadcrumbList"],
  "/colecao/todos": ["BreadcrumbList", "ItemList"],
  "/volta-18k": ["FAQPage", "ItemList", "BreadcrumbList"],
  "/politicas/privacidade": ["BreadcrumbList"],
  "/lancamento/kit-letz-bora": ["FAQPage", "BreadcrumbList"],
};
for (const [p, types] of Object.entries(LD)) {
  const res = await fetch(BASE + p, { headers: { "user-agent": UA } });
  if (res.status === 404 && p.startsWith("/lancamento/")) { warns.push(`${p}: 404 (produto do kit fora do catálogo), JSON-LD não conferido`); continue; }
  const html = await res.text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const found = [];
  for (const b of blocks) {
    try { const d = JSON.parse(b); for (const x of [d].flat()) found.push(x["@type"]); } catch (e) { fails.push(`${p}: JSON-LD inválido (${e.message})`); }
  }
  for (const t of types) ok(found.includes(t), `${p}: JSON-LD sem ${t} (achou ${found.join(", ") || "nada"})`);
  if (p.startsWith("/produto/")) {
    const prod = blocks.map((b) => JSON.parse(b)).flat().find((x) => x["@type"] === "Product");
    ok(prod?.offers?.price && prod.offers.priceCurrency === "BRL" && prod.offers.availability && prod.offers.hasMerchantReturnPolicy && prod.offers.shippingDetails, `${p}: Product.offers incompleto`);
    ok(Array.isArray(prod?.image) && prod.image.length > 0 && prod.sku && prod.brand?.name === "BORA", `${p}: Product sem image/sku/brand`);
  }
  ok(/<link rel="canonical"/.test(html), `${p}: sem canonical`);
  ok(/property="og:image"/.test(html) && /name="twitter:card"/.test(html), `${p}: sem og:image ou twitter:card`);
}
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
ok(sm.includes("<urlset") && sm.includes("/produto/") && sm.includes("/volta-18k") && sm.includes("/politicas/") && sm.includes("/experiencia"), "sitemap.xml incompleto");
const rb = await (await fetch(`${BASE}/robots.txt`)).text();
ok(/User-Agent: \*/i.test(rb), "robots.txt sem regra");
const og = await fetch(`${BASE}/opengraph-image`);
ok(og.ok && og.headers.get("content-type") === "image/png", "imagem OG da marca não gerou");

console.log(`${mine.length} eventos de teste · tipos: ${[...names].sort().join(", ")}`);
if (warns.length) console.log("Avisos:\n- " + warns.join("\n- "));
console.log(fails.length ? "FALHAS:\n- " + fails.join("\n- ") : "Tudo certo.");
process.exit(fails.length ? 1 : 0);
