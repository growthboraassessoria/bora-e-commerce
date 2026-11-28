// Conciliação com a Pagar.me: pergunta o status real dos pedidos Pix/cartão ainda pendentes ou que venceram
// nos últimos 7 dias e dá baixa nos que foram pagos. Rede de segurança para quando o webhook não chega.
// Roda pelo cron da Vercel (vercel.json) e pode ser chamada à mão com o mesmo segredo:
//   Authorization: Bearer <CRON_SECRET>
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db, storeMode } from "@/lib/server/db";
import { markOrderPaid, savePaymentData } from "@/lib/server/orders";
import { chargeOf, getPagarmeOrder, pagarmeEnabled } from "@/lib/server/pagarme";
import { snapshotOf } from "@/lib/server/pagarme-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pagarmeEnabled() || storeMode() !== "supabase") return NextResponse.json({ ok: true, ignored: "sem Pagar.me ou sem banco" });

  const url = new URL(req.url);
  // Por padrão só confere (não muda nada). Com ?baixa=1 (ou pelo cron) dá baixa nos pagos.
  const apply = url.searchParams.get("baixa") === "1" || req.headers.get("user-agent")?.includes("vercel-cron") === true;
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get("dias")) || 7));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("orders")
    .select("id, code, status, payment_id, paid_at")
    .eq("payment_provider", "pagarme")
    .like("payment_id", "or_%")
    .is("paid_at", null)
    .in("status", ["pending", "canceled"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result: { code: string; antes: string; pagarme: string; pago: boolean; baixa: boolean }[] = [];
  for (const o of data ?? []) {
    try {
      const po = await getPagarmeOrder(o.payment_id as string);
      const status = chargeOf(po)?.status ?? po.status;
      const paid = po.status === "paid" || status === "paid";
      if (apply) {
        await savePaymentData(o.id as string, snapshotOf(po), { type: "conciliacao", at: new Date().toISOString(), status });
        if (paid) await markOrderPaid(o.id as string, po.id);
      }
      result.push({ code: o.code as string, antes: o.status as string, pagarme: status, pago: paid, baixa: paid && apply });
    } catch (e) {
      result.push({ code: o.code as string, antes: o.status as string, pagarme: `erro: ${(e as Error).message.slice(0, 80)}`, pago: false, baixa: false });
    }
  }
  console.log("conciliacao", JSON.stringify({ conferidos: result.length, baixas: result.filter((r) => r.baixa).length }));
  return NextResponse.json({ ok: true, modo: apply ? "baixa" : "só conferência", dias: days, conferidos: result.length, pedidos: result });
}
