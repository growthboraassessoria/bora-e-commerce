import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getOrder, markOrderPaid } from "@/lib/server/orders";
import { chargeOf, getPagarmeOrder, pagarmeEnabled, PagarmeError } from "@/lib/server/pagarme";

// Webhook da Pagar.me (configurado no painel com usuário e senha: PAGARME_WEBHOOK_USER / PAGARME_WEBHOOK_PASSWORD).
// Nunca confia no corpo do aviso: consulta o pedido na Pagar.me com a chave secreta e só então dá baixa.
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const user = process.env.PAGARME_WEBHOOK_USER;
  const pass = process.env.PAGARME_WEBHOOK_PASSWORD;
  if (!user || !pass) return true; // sem credencial configurada, a segurança vem da consulta à API
  const got = req.headers.get("authorization") ?? "";
  const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Hook = { id?: string; type?: string; data?: { id?: string; object?: string; order?: { id?: string }; order_id?: string } };

export async function POST(req: Request) {
  if (!authorized(req)) {
    // Diagnóstico sem segredo: o tipo de credencial que chegou e se o usuário confere (a senha nunca vai para o log).
    const got = req.headers.get("authorization") ?? "";
    let user = "";
    if (got.startsWith("Basic ")) user = Buffer.from(got.slice(6), "base64").toString("utf8").split(":")[0] ?? "";
    console.warn("pagarme webhook 401", JSON.stringify({ scheme: got.split(" ")[0] || "nenhuma", userMatches: !!user && user === process.env.PAGARME_WEBHOOK_USER, userLength: user.length, ua: req.headers.get("user-agent")?.slice(0, 60) }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pagarmeEnabled()) return NextResponse.json({ ok: true, ignored: "pagarme desligada" });
  const hook = (await req.json().catch(() => null)) as Hook | null;
  const type = hook?.type ?? "";
  const pagarmeOrderId = type.startsWith("order.") ? hook?.data?.id : hook?.data?.order?.id ?? hook?.data?.order_id;
  if (!pagarmeOrderId || !/^or_[A-Za-z0-9]+$/.test(pagarmeOrderId)) return NextResponse.json({ ok: true, ignored: type || "sem pedido" });

  try {
    const po = await getPagarmeOrder(pagarmeOrderId);
    const ourId = po.metadata?.order_id;
    if (!ourId || !(await getOrder(ourId))) return NextResponse.json({ ok: true, ignored: "pedido de outra integração" });
    if (po.status === "paid" || chargeOf(po)?.status === "paid") {
      await markOrderPaid(ourId, po.id);
      return NextResponse.json({ ok: true, paid: true });
    }
    // Falha, cancelamento ou estorno: a reserva vence sozinha; estorno é registrado pela equipe no BORA OS.
    return NextResponse.json({ ok: true, status: po.status });
  } catch (e) {
    // Pedido que a Pagar.me não acha (ou de outra integração da mesma conta): não adianta reenviar.
    if (e instanceof PagarmeError && e.status === 404) return NextResponse.json({ ok: true, ignored: "pedido não encontrado" });
    console.error("pagarme webhook", type, e);
    return NextResponse.json({ error: "falha ao conferir o pedido" }, { status: 500 }); // a Pagar.me tenta de novo
  }
}
