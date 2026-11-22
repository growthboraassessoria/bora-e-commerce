// Compra de ponta a ponta no modo simulado. Uso: node scripts/qa-flow.mjs [base] [pasta-prints] [largura]
// 1) loja: produto → gaveta → comprar agora → checkout em etapas (cupom, Pix) → pagamento → obrigado
// 2) pré-venda Volta 18K: grade por tamanho → checkout com CEP de BH e retirada → obrigado com aviso de pré-venda
import puppeteer from "puppeteer-core";
const BASE = process.argv[2] || "http://localhost:3500";
const out = process.argv[3] || ".";
const width = Number(process.argv[4] || 1440);
const mobile = width < 700;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width, height: mobile ? 844 : 900, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const step = (m) => console.log("✓", m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = async (sel, text) => {
  const ok = await page.evaluate((sel, text) => {
    const all = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
    const el = all.find((e) => e.textContent.trim() === text) ?? all.find((e) => e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text);
  if (!ok) throw new Error(`não achei "${text}"`);
};
const type = async (label, value) => {
  const h = await page.evaluateHandle((label) => {
    const ls = [...document.querySelectorAll("label.field")].filter((l) => l.offsetParent !== null);
    const t = (l) => l.querySelector("span")?.firstChild?.textContent.trim() ?? "";
    return (ls.find((l) => t(l) === label) ?? ls.find((l) => t(l).startsWith(label)))?.querySelector("input");
  }, label);
  const el = h.asElement();
  if (!el) throw new Error(`campo "${label}" não encontrado`);
  await el.click();
  await el.evaluate((e) => e.select());
  await page.keyboard.press("Backspace");
  await el.type(value);
};
const continuar = async () => page.evaluate(() => document.querySelector("form[novalidate]").requestSubmit());
const has = (text) => page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: 15000 }, text);

async function fillAndPay({ prints, other = false, card = false }) {
  await page.waitForFunction(() => location.pathname === "/checkout", { timeout: 15000 });
  await has("Seus dados");
  await type("Nome completo", "Teste Loja BORA");
  await type("CPF", "52998224725");
  await type("E-mail", "qa-loja@gmial.com");
  await has("Você quis dizer");
  await clickText("button", "Você quis dizer");
  if (!(await page.evaluate(() => [...document.querySelectorAll("input")].some((i) => i.value === "qa-loja@gmail.com")))) throw new Error("sugestão de e-mail não aplicou");
  step("sugestão de e-mail corrigiu gmial → gmail");
  await type("Celular", "61999998888");
  await continuar();
  await has("Quem vai retirar as peças?");
  await has("Otacílio Negrão de Lima, 2827");
  step("etapa de retirada com o endereço do evento e a pergunta de quem retira");
  if (other) {
    await clickText("button", "Outra pessoa");
    await has("Nome completo de quem retira");
    await type("Nome completo de quem retira", "Joana Retira Silva");
    await type("CPF", "52998224725");
    await type("Celular (WhatsApp) de quem retira", "31988887777");
    await continuar();
    await has("É o seu CPF");
    step("recusou o CPF do próprio comprador para quem retira");
    await type("CPF", "11144477735");
    await continuar();
  } else {
    await clickText("button", "Eu mesmo");
    await continuar();
  }
  await has("Aprovação na hora");
  if (await page.evaluate(() => document.body.innerText.toLowerCase().includes("boleto"))) throw new Error("boleto ainda aparece");
  step("pagamento só com Pix e cartão");
  if (card) {
    await clickText("button[role=radio]", "Cartão");
    await has("Número do cartão");
    const opts = await page.evaluate(() => [...document.querySelectorAll('[aria-label=Parcelas] button')].map((b) => b.innerText.split(/\s/)[0]));
    if (opts.length > 3) throw new Error(`parcelas acima de 3x: ${opts.join(",")}`);
    await type("Número do cartão", "4000000000000010");
    await type("Nome impresso no cartão", "TESTE LOJA BORA");
    await type("Validade", "1230");
    await type("CVV", "123");
    await clickText("[aria-label=Parcelas] button", `${opts.length}x`);
    await type("CEP", "30160909");
    await type("Número", "362");
    await page.waitForFunction(() => [...document.querySelectorAll("label.field")].find((l) => l.textContent.startsWith("Cidade"))?.querySelector("input")?.value, { timeout: 10000 }).catch(async () => {
      await type("Rua", "Rua Teste"); await type("Bairro", "Centro"); await type("Cidade", "Belo Horizonte"); await type("UF", "MG");
    });
    step(`cartão preenchido no checkout, parcelas: ${opts.join(", ")}`);
  }
  await page.evaluate(() => document.querySelector("form[novalidate] input[type=checkbox]").click());
  await wait(400);
  if (prints) await page.screenshot({ path: `${out}/${prints}`, type: "jpeg", quality: 70, fullPage: !mobile });
  const t0 = Date.now();
  await continuar();
  await has("Não feche esta página");
  await wait(1800);
  await page.screenshot({ path: `${out}/flow-processando-${width}.jpg`, type: "jpeg", quality: 70 });
  if (card) {
    await page.waitForFunction(() => location.pathname.startsWith("/obrigado/"), { timeout: 25000 });
    await has("letz bora.");
    step(`cartão aprovado no próprio checkout e foi direto para o obrigado (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    return;
  }
  await page.waitForFunction(() => location.pathname.startsWith("/pagamento/"), { timeout: 20000 });
  const took = Date.now() - t0;
  if (took < 5000) throw new Error(`processamento durou só ${took} ms`);
  step(`tela de processamento ficou ${(took / 1000).toFixed(1)} s e seguiu para o pagamento`);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.innerText.includes("Simular pagamento aprovado")), { timeout: 30000 });
  await clickText("button", "Simular pagamento aprovado");
  await page.waitForFunction(() => location.pathname.startsWith("/obrigado/"), { timeout: 20000 });
  await has("letz bora.");
  step("obrigado com pagamento aprovado");
}

// ---------- 1) loja ----------
await page.goto(`${BASE}/produto/camiseta-letz-bora-algodao`, { waitUntil: "networkidle0" });
await clickText("button", mobile ? "Adicionar" : "Adicionar à sacola");
await wait(300);
await has("Escolha");
await clickText("#tamanhos button", "M");
await clickText("button", mobile ? "Adicionar" : "Adicionar à sacola");
await wait(1200);
if (!(await page.evaluate(() => document.querySelector('[role=dialog][aria-label=Sacola]')?.innerText.includes("Camiseta LETZ BORA")))) throw new Error("gaveta sem o item");
step("item na gaveta da sacola");
await page.goto(`${BASE}/checkout?cupom=LETZBORA`, { waitUntil: "networkidle0" });
await has("Cupom LETZBORA aplicado").catch(async () => { if (!mobile) throw new Error("cupom do link não aplicou"); });
step("cupom aplicado pelo link");
await fillAndPay({ prints: `flow-checkout-${width}.jpg` });

// produtos ocultos não abrem
const hidden = await page.goto(`${BASE}/produto/corta-vento-bora`);
if (hidden.status() !== 404) throw new Error("produto oculto ainda abre");
step("produtos fora da pasta estão ocultos (404)");

// ---------- 2) pré-venda ----------
await page.goto(`${BASE}/volta-18k`, { waitUntil: "networkidle0" });
if (await page.evaluate(() => /restantes|200 de 200/i.test(document.body.innerText))) throw new Error("ainda mostra contagem de peças");
await page.evaluate(() => document.getElementById("pecas").scrollIntoView());
const pressed = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll("#pecas > div")];
  const crop = blocks.find((b) => b.innerText.toLowerCase().includes("regata cropped bora"));
  const btn = [...crop.querySelectorAll("button[role=radio]")].find((b) => b.innerText.trim().split(/\s/)[0] === "P");
  btn?.click();
  return btn?.getAttribute("aria-label");
});
if (!pressed) throw new Error("tamanho P da regata não encontrado");
await wait(200);
await page.evaluate(() => {
  const crop = [...document.querySelectorAll("#pecas > div")].find((b) => b.innerText.toLowerCase().includes("regata cropped bora"));
  [...crop.querySelectorAll("button")].find((b) => b.innerText.includes("Garantir na pré-venda")).click();
});
step(`pré-venda sem contagem de peças; regata P escolhida (${pressed.replace(/\n/g, " ")})`);
await fillAndPay({ prints: null, other: true, card: true });
await has("Passe de retirada");
await has("Joana Retira Silva");
await has("Indicado por Teste");
step("passe mostra quem retira e quem indicou");
await has("Mostre este código na retirada");
if (!(await page.$("article[aria-label=\"Passe de retirada\"] svg path"))) throw new Error("QR do passe não apareceu");
step("obrigado mostra o passe de retirada com QR");
await page.screenshot({ path: `${out}/flow-obrigado-presale-${width}.jpg`, type: "jpeg", quality: 70, fullPage: true });

const url = new URL(page.url());
const r = await page.goto(`${BASE}${url.pathname}?t=errado`);
if (r.status() !== 404) throw new Error("obrigado abriu sem token válido");
step("obrigado bloqueado sem token");
await browser.close();
console.log(errs.length ? "erros: " + errs.join(" | ") : "sem erros de página");
