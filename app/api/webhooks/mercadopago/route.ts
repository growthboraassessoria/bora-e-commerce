import { NextResponse } from "next/server";
import { fetchMpPayment, validMpSignature } from "@/lib/server/payments";
import { getOrder, markOrderPaid } from "@/lib/server/orders";

// Notificação do Mercado Pago. O status vem sempre da API do MP, nunca do corpo da notificação.
export async function POST(req: Request) {
  if (!process.env.MP_ACCESS_TOKEN) return NextResponse.json({ ok: false }, { status: 404 });
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const type = body?.type || url.searchParams.get("type") || url.searchParams.get("topic");
  const dataId = String(body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true });
  if (!validMpSignature(req.headers, dataId)) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  const payment = await fetchMpPayment(dataId);
  if (!payment) return NextResponse.json({ error: "pagamento não encontrado" }, { status: 404 });
  if (payment.status === "approved") {
    const order = await getOrder(payment.external_reference);
    if (order && Math.round(payment.transaction_amount * 100) >= order.totalCents) await markOrderPaid(order.id, String(payment.id));
  }
  return NextResponse.json({ ok: true });
}
