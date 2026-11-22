// Varre as telas em várias larguras e aponta texto saindo da caixa (ou cortado) e rolagem lateral.
// Uso: node scripts/qa-overflow.mjs [base]
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const BASE = process.argv[2] || "http://localhost:3500";
let order = null;
try { order = [...JSON.parse(readFileSync(".data/loja.json", "utf8")).orders].reverse().find((o) => o.status === "paid"); } catch {}
const tok = (id) => createHmac("sha256", "dev-only-secret").update(`order:${id}`).digest("base64url").slice(0, 32);
const pages = [
  "/", "/volta-18k", "/colecao/todos", "/colecao/volta-18k", "/produto/camiseta-letz-bora-algodao", "/produto/regata-cropped-bora",
  "/carrinho", "/checkout", "/busca?q=bora", "/politicas/entrega", "/politicas/termos", "/experiencia", "/nao-existe",
  ...(order ? [`/obrigado/${order.id}?t=${tok(order.id)}`] : []),
];
const widths = [390, 768, 1024, 1280, 1440];
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const found = new Map();
for (const w of widths) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
  await p.goto(BASE + "/produto/camiseta-letz-bora-algodao", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => localStorage.setItem("bora-cart-v1", JSON.stringify({ lines: [{ variantId: "c1cam-pto-m", quantity: 1 }, { variantId: "c1crop-pto-p", quantity: 2 }], coupon: "" })));
  for (const path of pages) {
    await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, path === "/experiencia" || path === "/" || path === "/volta-18k" ? 2500 : 1200));
    // abre o seletor de tamanho clicando no primeiro tamanho disponível (estado "Selecionado")
    await p.evaluate(() => { const b = [...document.querySelectorAll("button[aria-pressed]")].find((x) => !x.disabled); b?.click(); });
    await new Promise((r) => setTimeout(r, 300));
    const issues = await p.evaluate((W) => {
      const out = [];
      // No modo celular o navegador alarga a janela quando o conteúdo passa: compara com a largura fixa da tela.
      const pageOv = document.documentElement.scrollWidth - W;
      if (pageOv > 1) out.push(`rolagem lateral de ${pageOv}px`);
      for (const el of document.querySelectorAll("main *, header *, footer *")) {
        if (!(el instanceof HTMLElement) || !el.offsetParent || el.closest("svg,canvas,[aria-hidden=true],.animate-marquee,.no-scrollbar,.overflow-x-auto")) continue;
        const cs = getComputedStyle(el);
        if (["auto", "scroll"].includes(cs.overflowX) || cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none") continue;
        if (el.classList.contains("sr-only") || (cs.position === "absolute" && el.clientWidth <= 1)) continue; // rótulo só para leitor de tela
        const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
        if (!text) continue;
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
          out.push(`${el.tagName.toLowerCase()} "${text.slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}${cs.overflowX === "hidden" ? " (cortado)" : ""}`);
        }
        const parent = el.parentElement;
        if (parent && cs.position !== "absolute" && cs.position !== "fixed") {
          const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect();
          if (r.right > pr.right + 3 && getComputedStyle(parent).overflowX === "visible" && pr.width > 0 && r.width < innerWidth) out.push(`${el.tagName.toLowerCase()} "${text.slice(0, 40)}" passa ${Math.round(r.right - pr.right)}px da caixa`);
        }
      }
      return [...new Set(out)].slice(0, 12);
    }, w);
    for (const i of issues) {
      const k = `${path.split("?")[0].replace(/\/obrigado\/.*/, "/obrigado")} · ${i}`;
      found.set(k, [...(found.get(k) ?? []), w]);
    }
  }
  await p.close();
}
await b.close();
if (!found.size) console.log("nenhum texto fora da caixa");
for (const [k, ws] of found) console.log(`${k}  [${ws.join(", ")}]`);
