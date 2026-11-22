"use server";
import { z } from "zod";
import { quote } from "@/lib/server/quote";
import { cancelPendingOrder, CouponExhaustedError, createOrder, markOrderPaid, orderToken, OutOfStockError, savePaymentData, setPaymentRef } from "@/lib/server/orders";
import { chargeOf, createCardOrder, PagarmeError, refusalMessage } from "@/lib/server/pagarme";
import { snapshotOf } from "@/lib/server/pagarme-snapshot";
import { installmentsFor } from "@/lib/payment-rules";
import { getPaymentRules } from "@/lib/server/settings";
import { paymentProvider, startPayment } from "@/lib/server/payments";
import { isValidCpf } from "@/lib/cpf";
import { onlyDigits } from "@/lib/shipping";
import { SALES_OPEN } from "@/lib/config";
import { rememberOrder } from "@/lib/server/order-cookie";
import { storeMode } from "@/lib/server/db";
import { storeLocked } from "@/lib/server/settings";
import { completeCheckout, TOKEN_RE } from "@/lib/server/checkouts";
import { brl } from "@/lib/money";

const Input = z.object({
  email: z.email("E-mail inválido").max(160),
  phone: z.string().transform(onlyDigits).refine((v) => v.length >= 10 && v.length <= 11, "Telefone com DDD"),
  name: z.string().trim().min(5, "Nome completo").max(120).refine((v) => v.includes(" "), "Nome e sobrenome"),
  cpf: z.string().refine(isValidCpf, "CPF inválido").transform(onlyDigits),
  shippingId: z.literal("retirada").default("retirada"),
  // Quem retira no evento: o próprio comprador ou outra pessoa (nome, CPF e celular dela).
  pickupSelf: z.boolean().default(true),
  pickupName: z.string().trim().max(120).optional(),
  pickupCpf: z.string().optional(),
  pickupPhone: z.string().optional(),
  method: z.enum(["pix", "card"]),
  // Cartão (Pagar.me): token gerado no navegador com a chave pública + endereço de cobrança. O número do cartão não chega aqui.
  card: z.object({
    token: z.string().regex(/^token_[A-Za-z0-9]+$/, "Token do cartão inválido"),
    installments: z.number().int().min(1).max(12),
    billing: z.object({
      zip: z.string().transform(onlyDigits).refine((v) => v.length === 8, "CEP com 8 dígitos"),
      street: z.string().trim().min(2).max(120),
      number: z.string().trim().min(1).max(20),
      complement: z.string().trim().max(60).optional(),
      district: z.string().trim().min(1).max(80),
      city: z.string().trim().min(2).max(64),
      uf: z.string().trim().length(2),
    }),
  }).optional(),
  /** Cartão em ambiente simulado (demonstração): só as parcelas. Nenhum dado do cartão vem para o servidor. */
  cardSim: z.object({ installments: z.number().int().min(1).max(12), brand: z.string().max(20).optional(), lastFour: z.string().regex(/^\d{4}$/).optional(), holder: z.string().max(64).optional() }).optional(),
  coupon: z.string().max(40).optional(),
  /** Automáticos que o cliente já sabe que não valem (avisados por este placeOrder). */
  exclude: z.array(z.string().max(40)).max(5).optional(),
  /** Total que a pessoa viu no resumo: se o servidor chegar em outro valor, pede para conferir. */
  expectedTotalCents: z.number().int().min(0).optional(),
  /** Token do carrinho abandonado (localStorage), para marcar como concluído. */
  checkoutToken: z.string().regex(TOKEN_RE).optional(),
  accept: z.literal(true, "Aceite os termos para continuar"),
  lines: z.array(z.object({ variantId: z.string().max(80), quantity: z.number().int().min(1).max(10) })).min(1, "Sacola vazia").max(30),
}).superRefine((d, ctx) => {
  if (d.pickupSelf) return;
  const name = d.pickupName ?? "";
  if (name.length < 5 || !name.includes(" ")) ctx.addIssue({ code: "custom", path: ["pickupName"], message: "Nome e sobrenome" });
  if (!isValidCpf(d.pickupCpf ?? "")) ctx.addIssue({ code: "custom", path: ["pickupCpf"], message: "CPF inválido" });
  else if (onlyDigits(d.pickupCpf ?? "") === onlyDigits(d.cpf)) ctx.addIssue({ code: "custom", path: ["pickupCpf"], message: "É o seu CPF: escolha “Eu mesmo”" });
  const p = onlyDigits(d.pickupPhone ?? "");
  if (p.length < 10 || p.length > 11) ctx.addIssue({ code: "custom", path: ["pickupPhone"], message: "Celular com DDD" });
});

export type PlaceOrderResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string; fields?: Record<string, string>; /** Automático que não vale para este CPF: o checkout tira do orçamento. */ dropDiscount?: string };

export async function placeOrder(raw: unknown): Promise<PlaceOrderResult> {
  if (!SALES_OPEN) return { ok: false, error: "A pré-venda ainda não abriu. Fale com a gente no WhatsApp." };
  if (await storeLocked()) return { ok: false, error: "A loja está fechada no momento. Recarregue a página para entrar com a senha." };
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Confira os campos destacados.", fields };
  }
  const d = parsed.data;
  // Regras do BORA OS (Loja → Pagar.me): forma de pagamento ligada e parcelas dentro do limite.
  const rules = await getPaymentRules();
  if (d.method === "pix" && !rules.pixEnabled) return { ok: false, error: "O Pix está indisponível agora. Escolha o cartão." };
  if (d.method === "card" && !rules.cardEnabled) return { ok: false, error: "O cartão está indisponível agora. Escolha o Pix." };
  // Com o CPF: aqui entra a regra "uma vez por cliente".
  const q = await quote({ lines: d.lines, coupon: d.coupon, method: d.method, cpf: d.cpf, exclude: d.exclude });
  if (!q.lines.length) return { ok: false, error: "Sua sacola está vazia." };
  if (q.stockIssues.length) return { ok: false, error: q.stockIssues.join(" ") };
  if (d.coupon && q.coupon && !q.coupon.ok) return { ok: false, error: q.coupon.message ?? "Cupom inválido.", fields: { coupon: q.coupon.message ?? "Cupom inválido" } };
  if (d.expectedTotalCents != null && d.expectedTotalCents !== q.totals.totalCents) {
    // Descobre se foi um desconto automático que este CPF já usou.
    const seen = await quote({ lines: d.lines, coupon: d.coupon, method: d.method, exclude: d.exclude });
    if (seen.discount?.automatic && seen.discount.code !== q.discount?.code) {
      return {
        ok: false, dropDiscount: seen.discount.code,
        error: `O desconto automático “${seen.discount.title}” já foi usado no seu CPF. O total ficou ${brl(q.totals.totalCents)}: confira o resumo e confirme de novo.`,
      };
    }
    return { ok: false, error: `O valor do pedido mudou para ${brl(q.totals.totalCents)}. Confira o resumo e confirme de novo.` };
  }
  const done = async (orderId: string) => {
    if (!d.checkoutToken) return;
    await completeCheckout(d.checkoutToken, orderId, { name: d.name, email: d.email.toLowerCase(), phone: d.phone, cpf: d.cpf }, d.method).catch((e) => console.error("completeCheckout", e));
  };

  try {
    const order = await createOrder({
      email: d.email.toLowerCase(), name: d.name, phone: d.phone, cpf: d.cpf,
      address: null,
      pickup: d.pickupSelf ? null : { name: d.pickupName!.trim(), cpf: onlyDigits(d.pickupCpf!), phone: onlyDigits(d.pickupPhone!) },
      shipping: q.selectedShipping, paymentMethod: d.method, paymentProvider: paymentProvider(),
      couponCode: q.discount?.code ?? null, lines: q.lines, totals: q.totals,
    });
    if (storeMode() === "local") await rememberOrder(order);

    // Cartão pela Pagar.me: cobra na hora. Aprovado → obrigado; recusado → cancela a reserva e mostra o motivo.
    if (order.paymentProvider === "pagarme" && d.method === "card") {
      if (!d.card) {
        await cancelPendingOrder(order.id, "Cartão sem token");
        return { ok: false, error: "Preencha os dados do cartão.", fields: { card: "Dados do cartão" } };
      }
      const allowed = installmentsFor(order.totalCents, rules).n;
      const t = orderToken(order.id);
      try {
        const po = await createCardOrder(order, { ...d.card, installments: Math.min(d.card.installments, allowed), statementDescriptor: rules.statementDescriptor });
        await setPaymentRef(order.id, po.id);
        await savePaymentData(order.id, snapshotOf(po), { type: "checkout.cartao", at: new Date().toISOString(), status: po.status });
        const charge = chargeOf(po);
        if (po.status === "paid" || charge?.status === "paid") {
          const paid = await markOrderPaid(order.id, po.id);
          if (storeMode() === "local" && paid) await rememberOrder(paid);
          await done(order.id);
          return { ok: true, redirectUrl: `/obrigado/${order.id}?t=${t}` };
        }
        if (["failed", "canceled"].includes(po.status) || ["failed", "canceled"].includes(charge?.status ?? "")) {
          await cancelPendingOrder(order.id, `Cartão recusado (${charge?.last_transaction?.status ?? po.status})`);
          return { ok: false, error: refusalMessage(po), fields: { card: "Cartão não aprovado" } };
        }
        // Em análise (antifraude/processando): a confirmação chega pelo webhook.
        await done(order.id);
        return { ok: true, redirectUrl: `/pagamento/${order.id}?t=${t}` };
      } catch (e) {
        await savePaymentData(order.id, { provider: "pagarme", method: "credit_card", transaction: { errors: [String((e as Error).message).slice(0, 300)] } }, { type: "checkout.erro", at: new Date().toISOString(), status: e instanceof PagarmeError ? String(e.status) : "erro" });
        await cancelPendingOrder(order.id, "Erro ao cobrar o cartão");
        console.error("pagarme card", e);
        if (e instanceof PagarmeError && e.status >= 400 && e.status < 500)
          return { ok: false, error: "Não conseguimos validar o cartão. Confira número, validade, CVV e o endereço de cobrança.", fields: { card: "Confira os dados" } };
        return { ok: false, error: "O pagamento com cartão está indisponível agora. Tente de novo ou use o Pix." };
      }
    }

    // Cartão simulado (demonstração): aprova na hora, igual à Pagar.me, e segue direto para o obrigado.
    if (order.paymentProvider === "simulado" && d.method === "card") {
      if (!d.cardSim) {
        await cancelPendingOrder(order.id, "Cartão sem dados");
        return { ok: false, error: "Preencha os dados do cartão.", fields: { card: "Dados do cartão" } };
      }
      const n = Math.min(d.cardSim.installments, installmentsFor(order.totalCents, rules).n);
      await savePaymentData(order.id, {
        provider: "simulado", method: "credit_card", orderCode: order.code, orderStatus: "paid", chargeStatus: "paid",
        amountCents: order.totalCents, paidAmountCents: order.totalCents, paidAt: new Date().toISOString(), createdAt: order.createdAt, installments: n,
        statementDescriptor: rules.statementDescriptor,
        card: { brand: d.cardSim.brand ?? null, lastFour: d.cardSim.lastFour ?? null, holderName: d.cardSim.holder ?? null },
        transaction: { status: "captured", success: true, operationType: "auth_and_capture", acquirerName: "simulado", acquirerMessage: "Transação aprovada (simulada)" },
      }, { type: "simulado.aprovado", at: new Date().toISOString(), status: "paid" });
      const paid = await markOrderPaid(order.id, `sim_card_${order.code}_${n}x`);
      if (storeMode() === "local" && paid) await rememberOrder(paid);
      await done(order.id);
      return { ok: true, redirectUrl: `/obrigado/${order.id}?t=${orderToken(order.id)}` };
    }

    const pay = await startPayment(order);
    if (pay.paymentRef) await setPaymentRef(order.id, pay.paymentRef);
    await done(order.id);
    return { ok: true, redirectUrl: pay.redirectUrl };
  } catch (e) {
    if (e instanceof OutOfStockError) return { ok: false, error: "Um item da sua sacola acabou de esgotar. Atualize a sacola e tente de novo." };
    if (e instanceof CouponExhaustedError) {
      if (q.discount?.automatic) return { ok: false, dropDiscount: q.discount.code, error: `Cupom esgotado: o desconto automático “${q.discount.title}” acabou de atingir o limite de usos. Confira o novo total e confirme de novo.` };
      return { ok: false, error: `Cupom esgotado: o ${e.code} acabou de atingir o limite de usos. Remova o cupom para continuar.`, fields: { coupon: "Cupom esgotado" } };
    }
    console.error("placeOrder", e);
    return { ok: false, error: "Não conseguimos criar o pedido agora. Tente de novo em instantes." };
  }
}
