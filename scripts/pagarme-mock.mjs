// Simulador local da API v5 da Pagar.me, só para testar a loja sem chave e sem cobrança.
// Uso: node scripts/pagarme-mock.mjs [porta]  ·  loja com PAGARME_API_URL=http://localhost:PORTA e PAGARME_SECRET_KEY=sk_mock
// Regras (iguais ao simulador oficial): CVV começando com 6 = recusado; Pix fica pago 6 s depois.
import http from "node:http";
const port = Number(process.argv[2] || 3590);
const tokens = new Map(), cards = new Map(), orders = new Map(), log = [];
let n = 0;
const id = (p) => `${p}_${(++n).toString(36).padStart(8, "0")}${Math.random().toString(36).slice(2, 10)}`;
const send = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" }); res.end(JSON.stringify(body)); };
http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, "http://x");
  let body = ""; for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : null;
  if (url.pathname === "/__log") return send(res, 200, log);
  if (url.pathname === "/tokens" && req.method === "POST") {
    if (!url.searchParams.get("appId")) return send(res, 401, { message: "appId" });
    if (req.headers.authorization) return send(res, 400, { message: "não envie Authorization no token" });
    const t = id("token"); tokens.set(t, json.card); log.push({ op: "token", last4: json.card.number.slice(-4) });
    return send(res, 200, { id: t, type: "card", card: { last_four_digits: json.card.number.slice(-4), brand: "Visa" } });
  }
  if (!/^Basic /.test(req.headers.authorization || "")) return send(res, 401, { message: "Authorization has been denied for this request." });
  if (url.pathname === "/customers" && req.method === "POST") { log.push({ op: "customer", body: json }); return send(res, 200, { id: id("cus"), ...json }); }
  const mCard = url.pathname.match(/^\/customers\/(cus_\w+)\/cards$/);
  if (mCard && req.method === "POST") {
    const card = tokens.get(json.token); if (!card) return send(res, 422, { message: "The request is invalid.", errors: { token: ["inválido ou usado"] } });
    tokens.delete(json.token); const c = id("card"); cards.set(c, card); log.push({ op: "card", billing: json.billing_address });
    return send(res, 200, { id: c, last_four_digits: card.number.slice(-4), brand: "Visa", status: "active" });
  }
  if (url.pathname === "/orders" && req.method === "POST") {
    const p = json.payments[0]; const oid = id("or"); const amount = json.items.reduce((s, i) => s + i.amount * i.quantity, 0);
    log.push({ op: "order", method: p.payment_method, amount, code: json.code, items: json.items, customer: json.customer ?? json.customer_id, installments: p.credit_card?.installments, metadata: json.metadata });
    let o;
    if (p.payment_method === "pix") {
      o = { id: oid, code: json.code, status: "pending", metadata: json.metadata, amount, created: Date.now(), charges: [{ id: id("ch"), status: "pending", last_transaction: { status: "waiting_payment", qr_code: "00020101021226820014br.gov.bcb.pix2560mock.pagar.me/qr/" + oid + "5204000053039865802BR6304ABCD", qr_code_url: null, expires_at: new Date(Date.now() + p.pix.expires_in * 1000).toISOString() } }] };
    } else {
      const card = cards.get(p.credit_card.card_id); const refused = !card || String(card.cvv || "").startsWith("6");
      o = { id: oid, code: json.code, status: refused ? "failed" : "paid", metadata: json.metadata, amount, charges: [{ id: id("ch"), status: refused ? "failed" : "paid", last_transaction: { status: refused ? "not_authorized" : "captured", acquirer_message: refused ? "Transação negada" : "Transação aprovada" } }] };
    }
    orders.set(oid, o); return send(res, 200, o);
  }
  const mOrder = url.pathname.match(/^\/orders\/(or_\w+)$/);
  if (mOrder && req.method === "GET") {
    const o = orders.get(mOrder[1]); if (!o) return send(res, 404, { message: "not found" });
    if (o.status === "pending" && Date.now() - o.created > 6000) { o.status = "paid"; o.charges[0].status = "paid"; o.charges[0].last_transaction.status = "paid"; }
    return send(res, 200, o);
  }
  send(res, 404, { message: "rota não simulada " + req.method + " " + url.pathname });
}).listen(port, () => console.log("pagarme-mock na porta", port));
