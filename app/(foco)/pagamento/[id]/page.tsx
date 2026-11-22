import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkOrderToken, getOrder, markOrderPaid, savePaymentData } from "@/lib/server/orders";
import { snapshotOf } from "@/lib/server/pagarme-snapshot";
import { chargeOf, getPagarmeOrder, type PagarmeOrder } from "@/lib/server/pagarme";
import AutoRefresh from "@/components/order/AutoRefresh";
import { paymentProvider } from "@/lib/server/payments";
import { brl } from "@/lib/money";
import FakeQr from "@/components/order/FakeQr";
import CopyButton from "@/components/order/CopyButton";
import { simulateApproval } from "./actions";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

export default async function PaymentPage({ params, searchParams }: PageProps<"/pagamento/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  if (!checkOrderToken(id, t)) notFound();
  const order = await getOrder(id);
  if (!order) notFound();
  if (order.status !== "pending") redirect(`/obrigado/${id}?t=${t}`);

  // Pagar.me: consulta o pedido lá (fonte da verdade). Pago → baixa aqui e segue para o obrigado, mesmo sem o webhook.
  if (order.paymentProvider === "pagarme") {
    let po: PagarmeOrder | null = null;
    if (order.paymentId) po = await getPagarmeOrder(order.paymentId).catch(() => null);
    const charge = po ? chargeOf(po) : null;
    if (po && (po.status === "paid" || charge?.status === "paid")) {
      await savePaymentData(order.id, snapshotOf(po), { type: "consulta.pago", at: new Date().toISOString(), status: po.status });
      await markOrderPaid(order.id, po.id);
      redirect(`/obrigado/${id}?t=${t}`);
    }
    const tx = charge?.last_transaction;
    const failed = po && (["failed", "canceled"].includes(po.status) || ["failed", "canceled"].includes(charge?.status ?? ""));
    return (
      <div className="wrap pt-6 pb-[max(48px,env(safe-area-inset-bottom))] sm:py-12 max-w-xl">
        {!failed ? <AutoRefresh /> : null}
        <p className="eyebrow">Pedido {order.code} · #{order.number}</p>
        <h1 className="display text-[clamp(34px,5vw,60px)] mt-2">{order.paymentMethod === "pix" ? "Pague com Pix" : "Pagamento em análise"}</h1>
        <p className="mt-3 text-ink-2">Total: <strong className="text-ink text-xl">{brl(order.totalCents)}</strong></p>
        {failed ? (
          <div className="mt-8 rounded-2xl bg-danger/10 text-danger p-5 font-bold">O pagamento não foi concluído. Monte a sacola de novo para tentar outra vez.</div>
        ) : order.paymentMethod === "pix" && tx?.qr_code ? (
          <div className="mt-6 sm:mt-8 card p-5 sm:p-8 grid sm:grid-cols-[200px_1fr] gap-6 items-center">
            <div className="rounded-2xl ring-1 ring-line p-3 bg-white w-full max-w-[240px] mx-auto sm:max-w-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {tx.qr_code_url ? <img src={tx.qr_code_url} alt="QR Code do Pix" width={176} height={176} className="w-full h-auto" /> : <FakeQr seed={order.id} />}
            </div>
            <div>
              <ol className="grid gap-2 text-[15px] sm:text-sm text-ink-2 list-decimal pl-5">
                <li>Abra o app do seu banco e escolha Pix.</li>
                <li>Escaneie o QR Code ou use o copia e cola.</li>
                <li>Confirme. Esta página segue sozinha quando o pagamento cair.</li>
              </ol>
              <div className="mt-4"><CopyButton text={tx.qr_code} /></div>
              {tx.expires_at ? <p className="mt-3 text-xs text-ink-3">Vale até {new Date(tx.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}. Depois disso o pedido é cancelado e as peças voltam para a grade.</p> : null}
            </div>
          </div>
        ) : (
          <div className="mt-8 card p-6 sm:p-8 text-ink-2">
            {order.paymentMethod === "pix" ? "Gerando o QR Code do Pix…" : "A operadora está analisando o pagamento. Assim que confirmar, esta página segue sozinha para a confirmação do pedido. Você também recebe por e-mail."}
          </div>
        )}
      </div>
    );
  }

  const simulated = paymentProvider() === "simulado";
  const pixCode = `00020126580014BR.GOV.BCB.PIX-SIMULACAO-BORA-${order.number}-${order.totalCents}`;
  const approve = simulateApproval.bind(null, id, t);

  return (
    <div className="wrap pt-6 pb-[max(48px,env(safe-area-inset-bottom))] sm:py-12 max-w-xl">
      <p className="eyebrow">Pedido #{order.number}</p>
      <h1 className="display text-[clamp(34px,5vw,60px)] mt-2">{order.paymentMethod === "pix" ? "Pague com Pix" : "Pagamento com cartão"}</h1>
      <p className="mt-3 text-ink-2">Total: <strong className="text-ink text-xl">{brl(order.totalCents)}</strong></p>

      {simulated ? <div className="mt-6 rounded-2xl bg-neon/40 ring-1 ring-neon-deep/30 p-4 text-sm"><strong>Ambiente de teste.</strong> O gateway de pagamento ainda não está ligado: nenhum valor é cobrado e o QR abaixo não funciona no banco.</div> : null}

      {order.paymentMethod === "pix" ? (
        <div className="mt-6 sm:mt-8 card p-5 sm:p-8 grid sm:grid-cols-[200px_1fr] gap-6 items-center">
          <div className="rounded-2xl ring-1 ring-line p-3 w-full max-w-[240px] mx-auto sm:max-w-none"><FakeQr seed={order.id} /></div>
          <div>
            <ol className="grid gap-2 text-[15px] sm:text-sm text-ink-2 list-decimal pl-5">
              <li>Abra o app do seu banco e escolha Pix.</li>
              <li>Escaneie o QR Code ou use o copia-e-cola.</li>
              <li>Confirme o pagamento. A gente avisa por e-mail.</li>
            </ol>
            <div className="mt-4"><CopyButton text={pixCode} /></div>
            <p className="mt-3 text-xs text-ink-3">O pedido fica reservado por 60 minutos.</p>
          </div>
        </div>
      ) : (
        <div className="mt-8 card p-6 sm:p-8 text-ink-2">
          Neste ambiente de teste o cartão não é cobrado: use o botão abaixo para simular a aprovação.
        </div>
      )}

      {simulated ? (
        <form action={approve} className="mt-8">
          <button className="btn btn-neon btn-lg btn-block">Simular pagamento aprovado</button>
        </form>
      ) : null}
    </div>
  );
}
