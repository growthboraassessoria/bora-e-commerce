// Prints das páginas (desktop e celular). Uso: node scripts/qa-shots.mjs <pasta-de-saida> [base]
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const out = process.argv[2] || "./.qa";
const BASE = process.argv[3] || "http://localhost:3500";
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"] });
const pages = [["presale", "/volta-18k"], ["home", "/"], ["colecao", "/colecao/todos"], ["produto", "/produto/camiseta-letz-bora-algodao"], ["cropped", "/produto/regata-cropped-bora"], ["colecao18k", "/colecao/volta-18k"], ["vendas", "/lancamento/kit-letz-bora"], ["politica", "/politicas/trocas-e-devolucoes"], ["experiencia", "/experiencia"]];
const errors = [];
for (const [vw, w, h, mobile] of [["desk", 1440, 900, false], ["mob", 390, 844, true]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  page.on("pageerror", (e) => errors.push(`${vw} pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${vw} console: ${m.text()}`));
  for (const [name, path] of pages) {
    await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, name === "home" || name === "experiencia" ? 3500 : 800));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1 || await page.evaluate(() => [...document.querySelectorAll("main *")].some((e) => e.getBoundingClientRect().right > window.innerWidth + 2 && getComputedStyle(e).position !== "fixed" && !e.closest(".overflow-x-auto,.overflow-hidden")))) errors.push(`${vw} ${name}: rolagem horizontal de ${overflow}px`);
    await page.screenshot({ path: `${out}/${vw}-${name}.jpg`, type: "jpeg", quality: 70 });
    if (name !== "experiencia") {
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await new Promise((r) => setTimeout(r, 800));
    }
    if (name !== "experiencia") await page.screenshot({ path: `${out}/${vw}-${name}-full.jpg`, type: "jpeg", quality: 50, fullPage: true });
  }
  await page.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "sem erros");
