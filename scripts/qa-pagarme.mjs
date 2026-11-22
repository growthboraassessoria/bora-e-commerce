// Teste do checkout com a Pagar.me usando o simulador local (scripts/pagarme-mock.mjs).
// Uso: node scripts/pagarme-mock.mjs 3590  e a loja com PAGARME_SECRET_KEY=sk_mock PAGARME_API_URL=http://localhost:3590
//      node scripts/qa-pagarme.mjs http://localhost:3530 http://localhost:3590 [largura]
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
const [, , BASE = "http://localhost:3530", MOCK = "http://localhost:3590", W = "1440"] = process.argv;
const width = Number(W), mobile = width < 700;
let fails = 0;
const ok = (c, m) => { console.log(c ? "✓" : "✗", m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const page = await b.newPage();
await page.setViewport({ width, height: mobile ? 844 : 900, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const field = async (label, value) => {
  const h = await page.evaluateHandle((label) => [...document.querySelectorAll("label.field")].find((l) => (l.querySelector("span")?.childNodes[0]?.textContent ?? "").trim() === label)?.querySelector("input"), label);
  const el = h.asElement(); if (!el) throw new Error(`campo "${label}" não encontrado`);
  await el.click(); await el.evaluate((e) => e.select()); await page.keyboard.press("Backspace"); await el.type(value);
};
const clickText = (sel, text) => page.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find((e) => e.innerText.trim().startsWith(text)); el?.click(); return !!el; }, sel, text);
const submit = () => page.evaluate(() => document.querySelector("form[novalidate]").requestSubmit());
const has = (t, timeout = 20000) => page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout }, t);
const stock = () => { try { return JSON.parse(readFileSync(".data/loja.json", "utf8")).stock["c1crop-pto-p"]; } catch { return undefined; } };

async function checkout(method, card) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.setItem("bora-cart-v1", JSON.stringify({ lines: [{ variantId: "c1crop-pto-p", quantity: 1 }], coupon: "" })); localStorage.removeItem("bora-checkout-draft"); });
  await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" });
  await has("Seus dados");
  await field("Nome completo", "Teste Pagarme BORA"); await field("CPF", "52998224725"); await field("E-mail", "qa-pagarme@example.com"); await field("Celular (WhatsApp)", "31988887777");
  await submit(); await has("Quem vai retirar as peças?"); await clickText("button", "Eu mesmo"); await submit();
  await has("Aprovação na hora");
  if (method === "card") {
    await clickText("button[role=radio]", "Cartão");
    await has("Número do cartão");
    await field("Número do cartão", card.number); await field("Nome impresso no cartão", "TESTE PAGARME BORA");
    await field("Validade", "12/30"); await field("CVV", card.cvv);
    // Espera o total do cartão (sem o desconto do Pix) aparecer nas parcelas antes de escolher.
    await page.waitForFunction(() => [...document.querySelectorAll("[aria-label=Parcelas] button")].some((x) => x.innerText.includes("40,00")), { timeout: 15000 });
    await clickText("[aria-label=Parcelas] button", "3x");
    await wait(200);
    const sel = await page.evaluate(() => document.querySelector("[aria-label=Parcelas] [aria-checked=true]")?.innerText.trim());
    console.log("   parcelas marcadas logo após o clique:", sel, "· opções:", await page.evaluate(() => [...document.querySelectorAll("[aria-label=Parcelas] button")].map((x) => x.innerText.replace(/\s+/g, " ")).join(" / ")));
    await field("CEP", "30160909");
    await page.waitForFunction(() => [...document.querySelectorAll("input")].some((i) => i.value.toLowerCase().includes("princesa")), { timeout: 15000 }).catch(() => {});
    await field("Número", "362");
    console.log("   parcelas marcadas antes de pagar:", await page.evaluate(() => document.querySelector("[aria-label=Parcelas] [aria-checked=true]")?.innerText.trim()));
  }
  await page.evaluate(() => document.querySelector("form[novalidate] input[type=checkbox]").click());
  await wait(300); await submit();
}

// Só conta o que esta rodada mandou para o simulador.
const startLog = (await fetch(MOCK + "/__log").then((r) => r.json())).length;
// 1) Pix
await checkout("pix");
await page.waitForFunction(() => location.pathname.startsWith("/pagamento/"), { timeout: 30000 });
await has("Pague com Pix");
ok(await page.evaluate(() => document.body.innerText.includes("Copiar") || !!document.querySelector("button")), "Pix: página com QR e copia e cola");
await page.waitForFunction(() => location.pathname.startsWith("/obrigado/"), { timeout: 40000 });
await has("letz bora.");
ok(true, "Pix: pagamento caiu e a página seguiu sozinha para o obrigado");
// 2) Cartão aprovado
await checkout("card", { number: "4000000000000010", cvv: "123" });
await page.waitForFunction(() => location.pathname.startsWith("/obrigado/"), { timeout: 40000 });
await has("letz bora.");
ok(true, "Cartão aprovado em 3x: direto para o obrigado");
// 3) Cartão recusado
const before = stock();
await checkout("card", { number: "4000000000000010", cvv: "612" });
await has("não foi aprovado", 40000);
ok(page.url().includes("/checkout"), "Cartão recusado: mensagem no checkout, sem sair da página");
ok(stock() === before, `Cartão recusado: peça voltou para a grade (estoque ${before} → ${stock()})`);
// 4) O que chegou na Pagar.me
const log = (await fetch(MOCK + "/__log").then((r) => r.json())).slice(startLog);
const orders = log.filter((l) => l.op === "order");
ok(orders.every((o) => o.items.reduce((s, i) => s + i.amount * i.quantity, 0) === o.amount), "Itens somam o total em todos os pedidos");
const pix = orders.find((o) => o.method === "pix"), cardO = orders.find((o) => o.method === "credit_card");
ok(pix && pix.customer?.document === "52998224725" && pix.customer?.phones?.mobile_phone?.area_code === "31", "Pix: cliente com CPF e celular");
ok(pix && pix.amount === 11400, `Pix: valor com 5% de desconto (${pix?.amount})`);
ok(cardO && cardO.installments === 3 && cardO.amount === 12000, `Cartão: 3x, sem desconto Pix (${cardO?.amount})`);
ok(log.some((l) => l.op === "card" && l.billing?.zip_code === "30160909" && /362/.test(l.billing?.line_1)), "Cartão: endereço de cobrança com CEP e número");
ok(!JSON.stringify(log).includes("4000000000000010") || log.filter((l) => JSON.stringify(l).includes("4000000000000010")).every((l) => l.op === "token"), "O número do cartão só aparece na geração do token (direto do navegador)");
ok(orders.every((o) => o.metadata?.order_id && /^BR-/.test(o.code)), "Pedido na Pagar.me com o ID BR-… e o id da loja");
// 5) Webhook
const hook = (auth, body) => fetch(BASE + "/api/webhooks/pagarme", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) }, body: JSON.stringify(body) });
ok((await hook(null, { type: "order.paid", data: { id: "or_x" } })).status === 401, "Webhook sem senha: 401");
ok((await hook("Basic " + Buffer.from("hookuser:errada").toString("base64"), { type: "order.paid", data: { id: "or_x" } })).status === 401, "Webhook com senha errada: 401");
const r = await hook("Basic " + Buffer.from("hookuser:hookpass").toString("base64"), { type: "order.paid", data: { id: "or_naoexiste1" } });
ok(r.status === 200, `Webhook com senha e pedido desconhecido: ignorado (${r.status} ${JSON.stringify(await r.json())})`);
await b.close();
console.log(errs.length ? "erros de página: " + errs.join(" | ") : "sem erros de página", fails ? `\nFALHAS: ${fails}` : "\ntudo certo");
