import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { checkOrderToken, getOrder } from "@/lib/server/orders";
import { brl } from "@/lib/money";
import { SITE_URL, STORE } from "@/lib/config";
import { PICKUP, PRESALE, pickupWhen } from "@/lib/presale";
import AfterOrder from "@/components/order/AfterOrder";
import OrderSteps from "@/components/order/OrderSteps";
import { customerSteps } from "@/lib/etapas";
import PaymentIcons from "@/components/ui/PaymentIcons";
import { ArrowIcon, CardIcon, CheckIcon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Pedido confirmado", robots: { index: false } };

const METHOD = { pix: "Pix", card: "Cartão de crédito" } as const;
const sizeOf = (label: string) => label.split(" · ").pop() ?? label;
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null);

export default async function ThankYouPage({ params, searchParams }: PageProps<"/obrigado/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  if (!checkOrderToken(id, t)) notFound();
  const order = await getOrder(id);
  if (!order) notFound();

  const paid = order.status === "paid" || order.status === "shipped" || order.status === "delivered";
  const canceled = order.status === "canceled";
  const pending = !paid && !canceled;
  const delivered = order.status === "delivered";
  const first = order.name.split(" ")[0];
  const other = order.pickupName ?? null;
  const pieces = order.items.reduce((n, it) => n + it.quantity, 0);

  // QR do passe: abre esta mesma página (link assinado), para a equipe conferir o pedido na retirada.
  const qr = paid ? await QRCode.toString(`${SITE_URL}/obrigado/${order.id}?t=${t}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } }) : null;

  // Mesmas etapas da linha de processo do BORA OS (lib/etapas.ts).
  const steps = customerSteps(order);

  return (
    <div className="overflow-x-clip">
      <AfterOrder
        pending={order.status === "pending"}
        purchase={paid ? {
          transactionId: order.code, valueCents: order.totalCents, coupon: order.couponCode, paymentType: order.paymentMethod,
          items: order.items.map((it) => ({ item_id: it.productId, item_name: it.name, item_variant: it.variantLabel, price: it.unitCents / 100, quantity: it.quantity })),
        } : null}
      />

      {/* ---------- Topo: mensagem + passe de retirada ---------- */}
      <section className="wrap pt-8 pb-12 lg:pt-14 lg:pb-16 grid [&>*]:min-w-0 lg:grid-cols-[1fr_minmax(0,500px)] gap-10 lg:gap-20 items-center">
        <div>
          <p className={`inline-flex items-center gap-2 h-8 pl-1.5 pr-3.5 rounded-full text-xs font-black uppercase tracking-[0.08em] ${paid ? "bg-neon text-black" : canceled ? "bg-danger/10 text-danger" : "bg-sand text-ink-2"}`}>
            <span className={`size-5 rounded-full grid place-items-center ${paid ? "bg-black text-neon" : canceled ? "bg-danger text-white" : "bg-white"}`}>
              {paid ? <CheckIcon size={12} /> : canceled ? <span className="text-[10px]">✕</span> : <span className="size-2 rounded-full bg-ink-3 animate-pulse" />}
            </span>
            {delivered ? "Peças retiradas" : paid ? "Pagamento aprovado" : canceled ? "Pedido cancelado" : "Aguardando pagamento"}
            <span className="opacity-50">·</span> {order.code}
          </p>

          <h1 className="display text-[clamp(44px,7vw,104px)] mt-6">
            {paid ? <>Valeu, {first}!<br /><span className="mark">letz BORA.</span></> : canceled ? <>Pedido<br />cancelado.</> : <>Quase lá,<br /><span className="mark">{first}.</span></>}
          </h1>

          <p className="mt-6 text-lg text-ink-2 max-w-[34rem] leading-relaxed">
            {delivered ? (
              <>Você retirou suas peças em {time(order.pickedUpAt ?? null)}. Agora é treinar e postar com <strong className="text-ink">#letzBORA</strong>.</>
            ) : paid ? (
              <>{order.packedAt ? "Sua peça já está separada no seu nome." : "Suas peças estão reservadas no seu nome."} A confirmação foi para <strong className="text-ink">{order.email}</strong>. No evento, é só mostrar o passe.</>
            ) : canceled ? (
              "O prazo para pagar terminou e as peças voltaram para a grade. Se ainda quiser, é só montar a sacola de novo."
            ) : (
              <>Estamos esperando a confirmação do {METHOD[order.paymentMethod]}. Esta página atualiza sozinha e o passe libera assim que o pagamento cair.</>
            )}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {pending && order.paymentProvider === "simulado" ? (
              <Link href={`/pagamento/${order.id}?t=${t}`} className="btn btn-primary btn-lg">Ir para o pagamento <ArrowIcon size={18} /></Link>
            ) : null}
            {canceled ? (
              <Link href={PRESALE.path} className="btn btn-primary btn-lg">Voltar para a pré-venda <ArrowIcon size={18} /></Link>
            ) : (
              <a href={PICKUP.mapsUrl} target="_blank" rel="noopener noreferrer" className={`btn btn-lg ${pending ? "btn-ghost" : "btn-primary"}`}>Ver rota até a retirada <ArrowIcon size={18} /></a>
            )}
            <Link href="/colecao/todos" className="btn btn-ghost btn-lg">Continuar comprando</Link>
          </div>
          <p className="mt-5 text-sm text-ink-2">
            Acompanhe em <Link href="/meus-pedidos" className="font-bold text-ink underline underline-offset-4">Meus pedidos</Link>: é só o CPF e o celular da compra.
          </p>

          {/* Linha do tempo */}
          {!canceled ? (
            <OrderSteps
              steps={steps}
              className="mt-12 max-w-[38rem]"
              hints={{
                pagamento: paid ? METHOD[order.paymentMethod] : "Aguardando",
                processamento: paid ? "Equipe BORA" : "Depois do pagamento",
                separado: paid ? "No seu nome" : null,
                retirado: order.shippingMethod === "retirada" || !order.shippingMethod ? `${PICKUP.opens} às ${PICKUP.closes}` : null,
              }}
            />
          ) : null}
        </div>

        {/* Passe de retirada */}
        {!canceled ? (
          <div className="relative mx-auto w-full max-w-[500px] lg:rotate-[1.5deg] transition-transform duration-500 hover:rotate-0">
            <Image src="/img/marca/sticker-letz-bora-green.webp" alt="" width={240} height={240} className="hidden sm:block absolute -top-12 -right-8 w-28 rotate-12 z-20 drop-shadow-[0_12px_24px_rgba(0,0,0,.25)] pointer-events-none" />
            <article className="relative rounded-[28px] bg-ink text-white shadow-float overflow-hidden" aria-label="Passe de retirada">
              <Image src="/img/marca/bora-contornos.svg" alt="" width={600} height={600} className="absolute -right-24 -top-24 w-[420px] opacity-[0.08] pointer-events-none" />

              <div className="relative p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-neon">Passe de retirada</p>
                    <p className="mt-3 display text-[34px] sm:text-[56px] whitespace-nowrap">{PRESALE.name}</p>
                    <p className="mt-1 text-sm text-white/60">{PRESALE.edition}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">ID do pedido</p>
                    <p className="mt-1 font-mono text-lg sm:text-2xl font-bold tracking-wider text-neon">{order.code}</p>
                    <p className="text-xs text-white/40">Pedido #{order.number}</p>
                  </div>
                </div>

                <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                  <div className="col-span-2"><dt className="text-[11px] uppercase tracking-[0.16em] text-white/50">Local</dt><dd className="mt-1 font-bold">{PICKUP.address}</dd><dd className="text-white/60">{PICKUP.city}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-[0.16em] text-white/50">Quando</dt><dd className="mt-1 font-bold">{PRESALE.eventDate ?? "Dia da prova"}</dd><dd className="text-white/60">{PICKUP.opens} às {PICKUP.closes}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-[0.16em] text-white/50">Quem retira</dt><dd className="mt-1 font-bold truncate">{other ?? order.name}</dd><dd className="text-white/60">{other ? `Indicado por ${first}` : "Com documento"}</dd></div>
                </dl>

                <ul className="mt-6 flex flex-wrap gap-2">
                  {order.items.map((it) => (
                    <li key={it.variantId} className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-white/[0.07] ring-1 ring-white/10 text-sm">
                      <span className="size-7 rounded-full bg-neon text-black grid place-items-center text-[11px] font-black">{sizeOf(it.variantLabel)}</span>
                      <span className="font-bold">{it.name.replace("Regata ", "")}</span>
                      {it.quantity > 1 ? <span className="text-white/50">×{it.quantity}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>

              {/* picote */}
              <div className="relative h-0 border-t-2 border-dashed border-white/15 mx-6" aria-hidden>
                <span className="absolute -left-[38px] -top-[14px] size-7 rounded-full bg-white" />
                <span className="absolute -right-[38px] -top-[14px] size-7 rounded-full bg-white" />
              </div>

              <div className="relative p-6 sm:p-8 flex items-center gap-5 sm:gap-6">
                <div className="relative size-[112px] sm:size-[124px] shrink-0 rounded-2xl bg-white p-2.5">
                  {qr ? (
                    <div className={`size-full [&>svg]:size-full ${delivered ? "opacity-20" : ""}`} dangerouslySetInnerHTML={{ __html: qr }} />
                  ) : (
                    <div className="size-full rounded-lg bg-[repeating-linear-gradient(45deg,#ebebe6_0_6px,#f5f5f1_6px_12px)] grid place-items-center text-center text-[10px] font-bold text-ink-3 leading-tight px-2">Libera após o pagamento</div>
                  )}
                  {delivered ? <span className="absolute inset-0 grid place-items-center"><span className="-rotate-12 rounded-md border-[3px] border-ink bg-neon px-2 py-0.5 text-sm font-black uppercase tracking-widest text-black">Retirado</span></span> : null}
                </div>
                <div className="min-w-0">
                  <p className="font-black uppercase tracking-tight leading-tight">{delivered ? "Peças retiradas" : paid ? "Mostre este código na retirada" : "Seu passe está quase pronto"}</p>
                  <p className="mt-1.5 text-sm text-white/60 leading-snug">{delivered ? `Entregue em ${time(order.pickedUpAt ?? null)}. Bom treino!` : paid ? `Tire um print desta tela. No balcão, também vale falar o ID ${order.code}.` : "Assim que o pagamento for aprovado, o código aparece aqui."}</p>
                  <p className="mt-3 text-xs text-white/40">{pieces} {pieces === 1 ? "peça" : "peças"} · {METHOD[order.paymentMethod]}</p>
                </div>
              </div>
            </article>
          </div>
        ) : null}
      </section>

      {/* ---------- Pedido e retirada ---------- */}
      <section className="bg-sand">
        <div className="wrap py-12 lg:py-16 grid [&>*]:min-w-0 lg:grid-cols-[1.15fr_1fr] gap-6 lg:gap-8 items-start">
          <div className="card p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-black uppercase tracking-tight">Seu pedido</h2>
              <p className="text-sm text-ink-3"><span className="font-mono font-bold text-ink">{order.code}</span> · #{order.number} · {time(order.createdAt)}</p>
            </div>
            <ul className="mt-5 divide-y divide-line">
              {order.items.map((it) => (
                <li key={it.variantId} className="flex items-center gap-4 py-4">
                  <div className="relative size-20 rounded-2xl overflow-hidden bg-sand shrink-0">
                    <Image src={it.image} alt="" fill sizes="80px" className="object-cover" />
                    <span className="absolute -top-0 -right-0 min-w-6 h-6 px-1.5 rounded-bl-xl bg-ink text-white text-[11px] font-black grid place-items-center">{it.quantity}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight">{it.name}</p>
                    <p className="mt-1 text-sm text-ink-3">{it.variantLabel.replace(" · ", " · Tam. ")}</p>
                  </div>
                  <p className="font-bold whitespace-nowrap">{brl(it.unitCents * it.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-2 pt-5 border-t border-line grid gap-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd className="font-bold">{brl(order.subtotalCents)}</dd></div>
              {order.discountCents ? (
                <div className="flex justify-between"><dt className="text-ink-2">Descontos{order.couponCode ? <span className="ml-2 chip chip-soft h-6 px-2 text-[10px]">{order.couponCode}</span> : null}</dt><dd className="font-bold text-neon-deep">− {brl(order.discountCents)}</dd></div>
              ) : null}
              <div className="flex justify-between"><dt className="text-ink-2">Retirada no evento</dt><dd className="font-bold">Grátis</dd></div>
              <div className="flex justify-between items-baseline pt-4 mt-1 border-t border-line"><dt className="font-bold">Total</dt><dd className="text-3xl font-black tracking-tight">{brl(order.totalCents)}</dd></div>
            </dl>
            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-sand px-4 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                {order.paymentMethod === "pix" ? <PaymentIcons only={["Pix"]} /> : <span className="size-[38px] h-6 grid place-items-center rounded bg-ink text-white"><CardIcon size={16} /></span>}
                <p className="text-sm font-bold truncate">{METHOD[order.paymentMethod]}</p>
              </div>
              <p className={`text-xs font-black uppercase tracking-[0.08em] ${paid ? "text-neon-deep" : canceled ? "text-danger" : "text-ink-3"}`}>{paid ? "Aprovado" : canceled ? "Não concluído" : "Aguardando"}</p>
            </div>
            {order.discountCents && paid ? <p className="mt-4 text-sm text-ink-2">Você economizou <strong className="mark">{brl(order.discountCents)}</strong> nesta compra.</p> : null}
          </div>

          <div className="grid gap-6">
            <div className="card p-6 sm:p-8">
              <h2 className="text-xl font-black uppercase tracking-tight">Na retirada</h2>
              <ol className="mt-5 grid gap-4">
                {[
                  other
                    ? [`${other.split(" ")[0]} retira por você`, `Encaminhe este passe ou o e-mail de confirmação. ${other.split(" ")[0]} leva um documento com foto.`]
                    : ["Leve um documento com foto", "E mostre o passe (print ou e-mail de confirmação)."],
                  ["Experimente na hora", "Se o tamanho não servir, trocamos ali mesmo, se ainda houver na grade."],
                  other
                    ? ["Mudou quem vai buscar?", `Fale com a gente pelo e-mail ou WhatsApp antes do evento com o ID ${order.code}.`]
                    : ["Não vai conseguir ir?", `Fale com a gente pelo e-mail ou WhatsApp antes do evento com o ID ${order.code} e o nome e CPF de quem vai buscar.`],
                ].map(([h, d], i) => (
                  <li key={h} className="flex gap-4">
                    <span className="size-8 shrink-0 rounded-full bg-neon grid place-items-center text-sm font-black">{i + 1}</span>
                    <div><p className="font-bold leading-tight">{h}</p><p className="mt-1 text-sm text-ink-2 leading-relaxed">{d}</p></div>
                  </li>
                ))}
              </ol>
              <p className="mt-6 pt-5 border-t border-line text-sm text-ink-3">
                Dúvidas? <a href={`mailto:${STORE.email}`} className="font-bold text-ink underline underline-offset-4">{STORE.email}</a> · <Link href="/politicas/entrega" className="font-bold text-ink underline underline-offset-4">Regras da retirada</Link>
              </p>
            </div>

            <div className="relative rounded-[24px] bg-ink text-white p-6 sm:p-8 overflow-hidden">
              <Image src="/img/marca/sticker-fist-bump-green.webp" alt="" width={200} height={200} className="absolute right-4 bottom-4 w-24 sm:w-28 rotate-12 pointer-events-none" />
              <p className="relative text-2xl font-black uppercase tracking-tight leading-none">Poste com<br /><span className="text-neon">#letzBORA</span></p>
              <p className="relative mt-3 text-sm text-white/65 max-w-[16rem]">No dia da prova, marca a BORA com a peça nova.</p>
              <a href={STORE.instagram} target="_blank" rel="noopener noreferrer" className="relative btn btn-neon mt-5 h-11">Seguir a BORA</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
