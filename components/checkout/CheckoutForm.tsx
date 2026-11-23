"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cart, cartCount, useCart } from "@/lib/cart";
import { useQuote } from "@/lib/useQuote";
import { brl } from "@/lib/money";
import { usePaymentRules } from "@/components/store/PaymentRulesProvider";
import { BRAND_NAMES, installmentsFor } from "@/lib/payment-rules";
import { onlyDigits } from "@/lib/shipping";
import { formatCpf, formatPhone, isValidCpf } from "@/lib/cpf";
import { emailSuggestion, isEmail } from "@/lib/smart";
import { PICKUP, pickupWhen } from "@/lib/presale";
import PaymentIcons from "@/components/ui/PaymentIcons";
import ExtraOffer from "@/components/ui/ExtraOffer";
import ProcessingOverlay, { MIN_PROCESSING_MS } from "./ProcessingOverlay";
import { placeOrder } from "@/app/(foco)/checkout/actions";
import { CardIcon, CheckIcon, LockIcon, PixIcon, PlusIcon, ShieldIcon } from "@/components/ui/Icons";
import CouponField from "./CouponField";
import CardFields, { billingErrors, EMPTY_BILLING, EMPTY_CARD, type BillingState, type CardState } from "./CardFields";
import { cardBrand, cardErrors, pagarmeCardEnabled, tokenizeCard } from "@/lib/pagarme-client";
import { track } from "@/lib/analytics";
import { adoptCheckoutToken, checkoutToken, markCheckoutRecovered, syncCheckout } from "@/lib/checkout-session";
import { discountLabel } from "./Summary";
import { ChevronRight, Segmented, useKeyboardOpen } from "@/components/ui/ios";

type Method = "pix" | "card";
type Step = 1 | 2 | 3;
type Form = { email: string; phone: string; name: string; cpf: string; pickupSelf: boolean; pickupName: string; pickupCpf: string; pickupPhone: string };
type TextKey = Exclude<keyof Form, "pickupSelf">;
const EMPTY: Form = { email: "", phone: "", name: "", cpf: "", pickupSelf: true, pickupName: "", pickupCpf: "", pickupPhone: "" };
export const DRAFT = "bora-checkout-draft";

/** Link de recuperação do carrinho abandonado (/checkout?recuperar=<token>). */
export type Recovery =
  | { token: string; completed: true }
  | { token: string; completed: false; lines: { variantId: string; quantity: number }[]; coupon?: string; contact: { name: string; email: string; phone: string } };

export type Suggestion = { slug: string; name: string; priceCents: number; image: string; variants: { id: string; label: string; stock: number }[] };

// ---------------- validação por etapa ----------------
// Etapa 1: quem está comprando.
function contactErrors(f: Form) {
  const e: Record<string, string> = {};
  if (f.name.trim().split(/\s+/).length < 2) e.name = "Nome e sobrenome";
  if (!isValidCpf(f.cpf)) e.cpf = "CPF inválido";
  if (!isEmail(f.email)) e.email = "Digite um e-mail válido";
  const p = onlyDigits(f.phone);
  if (p.length < 10 || p.length > 11) e.phone = "Celular com DDD";
  return e;
}
// Etapa 2: quem vai retirar (só pede dados se não for o comprador).
function deliveryErrors(f: Form) {
  const e: Record<string, string> = {};
  if (f.pickupSelf) return e;
  if (f.pickupName.trim().split(/\s+/).length < 2) e.pickupName = "Nome e sobrenome";
  if (!isValidCpf(f.pickupCpf)) e.pickupCpf = "CPF inválido";
  else if (onlyDigits(f.pickupCpf) === onlyDigits(f.cpf)) e.pickupCpf = "É o seu CPF: escolha “Eu mesmo”";
  const p = onlyDigits(f.pickupPhone);
  if (p.length < 10 || p.length > 11) e.pickupPhone = "Celular com DDD";
  return e;
}
const STEP1 = ["name", "cpf", "email", "phone"];

// ---------------- peças de interface ----------------
function Field({ label, error, ok, className = "", children }: { label: string; error?: string; ok?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`field ${className}`}>
      <span className="flex items-center justify-between gap-2">
        {label}
        {error ? <span className="text-xs font-bold text-danger">{error}</span> : ok ? <span className="size-4 rounded-full bg-neon grid place-items-center"><CheckIcon size={10} /></span> : null}
      </span>
      {children}
    </label>
  );
}

function StepCard({ n, title, step, done, summary, onEdit, children }: { n: Step; title: string; step: Step; done: boolean; summary?: React.ReactNode; onEdit: () => void; children: React.ReactNode }) {
  const open = step === n;
  const locked = !open && !done;
  return (
    // Celular: a etapa aberta fica "solta" no fundo cinza (com listas agrupadas brancas, como nos Ajustes do iOS);
    // as etapas fechadas viram cartões brancos com o resumo. Desktop: como antes.
    <section id={`etapa-${n}`} className={`scroll-mt-[72px] lg:scroll-mt-24 rounded-[22px] lg:rounded-[28px] transition-all duration-500 ${open ? "py-2 lg:bg-white lg:shadow-[var(--shadow-card)] lg:ring-1 lg:ring-line lg:p-8" : "bg-white ring-1 ring-line px-4 py-3.5 sm:px-6 lg:bg-transparent lg:ring-0 lg:px-8 lg:py-5"} ${locked ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 min-h-11">
        <span className={`size-8 lg:size-9 shrink-0 rounded-full grid place-items-center text-sm font-black transition-colors ${done && !open ? "bg-neon text-black" : open ? "bg-ink text-white" : "ring-1 ring-line-strong text-ink-3"}`}>
          {done && !open ? <CheckIcon size={16} /> : n}
        </span>
        <h2 className={`font-black uppercase tracking-tight flex-1 ${open ? "text-[22px] lg:text-xl" : "text-[17px] lg:text-xl"}`}>{title}</h2>
        {done && !open ? <button type="button" onClick={onEdit} className="pressable h-11 -mr-2 px-2 text-[15px] font-bold lg:underline underline-offset-4">Alterar</button> : null}
      </div>
      {done && !open && summary ? <div className="mt-1 pl-11 lg:pl-12 text-sm text-ink-2 leading-relaxed [overflow-wrap:anywhere]">{summary}</div> : null}
      {open ? <div className="mt-4 lg:mt-6 animate-rise">{children}</div> : null}
    </section>
  );
}

function Progress({ step }: { step: Step }) {
  const items = ["Sacola", "Seus dados", "Retirada", "Pagamento"];
  return (
    <>
    {/* Celular: três tracinhos e o nome da etapa (cabe em qualquer largura) */}
    <div className="sm:hidden" aria-label={`Etapa ${step} de 3: ${items[step]}`}>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((i) => <span key={i} className="h-1 flex-1 rounded-full bg-sand-2 overflow-hidden"><span className="block h-full bg-ink transition-[width] duration-500 ease-out-expo" style={{ width: i <= step ? "100%" : "0%" }} /></span>)}
      </div>
      <p className="mt-2 text-[13px] font-bold text-ink-3">Etapa {step} de 3 · <span className="text-ink">{items[step]}</span></p>
    </div>
    <ol className="hidden sm:flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-widest" aria-label="Etapas">
      {items.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <span className={`whitespace-nowrap ${current ? "text-ink" : done ? "text-ink-2" : "text-ink-3"}`}>{label}</span>
            {i < items.length - 1 ? (
              <span className="flex-1 h-1 rounded-full bg-sand-2 overflow-hidden min-w-4">
                <span className="block h-full bg-neon transition-[width] duration-700 ease-out-expo" style={{ width: done ? "100%" : "0%" }} />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
    </>
  );
}

// ---------------- checkout ----------------
export default function CheckoutForm({ error: initialError, suggestions, initialCoupon, recovery, gateway = "simulado" }: { error?: string; suggestions: Suggestion[]; initialCoupon?: string; recovery?: Recovery; gateway?: "pagarme" | "simulado" }) {
  const { lines, coupon } = useCart();
  const [f, setF] = useState<Form>(EMPTY);
  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState<Step>(1);
  const rules = usePaymentRules();
  const methods: Method[] = [...(rules.pixEnabled ? (["pix"] as const) : []), ...(rules.cardEnabled ? (["card"] as const) : [])];
  const [method, setMethod] = useState<Method>(rules.pixEnabled || !rules.cardEnabled ? "pix" : "card");
  const [accept, setAccept] = useState(false);
  // Cartão (Pagar.me): fica só na memória da página, nunca no rascunho.
  const [card, setCard] = useState<CardState>(EMPTY_CARD);
  const [billing, setBilling] = useState<BillingState>(EMPTY_BILLING);
  // Cartão sempre preenchido aqui no checkout. Com a Pagar.me ligada vira token; em demonstração só valida e simula.
  const cardLive = method === "card" && gateway === "pagarme" && pagarmeCardEnabled();
  const cardForm = method === "card";
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Descontos automáticos que o servidor avisou que não valem para este CPF.
  const [exclude, setExclude] = useState<string[]>([]);
  const { quote, loading } = useQuote({ lines, coupon, method, ...(exclude.length ? { exclude } : {}) }, lines.length > 0);
  const begun = useRef(false);

  useEffect(() => setMounted(true), []);
  // Celular: com o teclado aberto, a barra de pagar some (no iOS ela ficaria por cima do teclado).
  const keyboard = useKeyboardOpen();
  // Erro de pagamento no celular: rola até o aviso, para a pessoa ver o que aconteceu.
  useEffect(() => {
    if (!error || window.innerWidth >= 1024) return;
    requestAnimationFrame(() => document.getElementById("checkout-erro")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [error]);
  // "Enter"/"Seguir" do teclado: vai para o próximo campo da etapa. No último campo, continua (etapas 1 e 2)
  // ou só fecha o teclado (pagamento: pagar é sempre no botão).
  const onEnter = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const el = e.target as HTMLElement;
    if (e.key !== "Enter" || !(el instanceof HTMLInputElement) || el.type === "checkbox") return;
    const box = document.getElementById(`etapa-${step}`);
    const fields = box ? [...box.querySelectorAll<HTMLInputElement>("input:not([type=checkbox]):not([type=hidden])")].filter((i) => i.offsetParent !== null && !i.disabled) : [];
    const at = fields.indexOf(el);
    if (at >= 0 && at < fields.length - 1) { e.preventDefault(); fields[at + 1].focus(); return; }
    if (step === 3) { e.preventDefault(); el.blur(); }
  };

  // Cupom vindo do link (?cupom=LETZBORA)
  useEffect(() => {
    if (initialCoupon && !coupon) cart.setCoupon(initialCoupon);
  }, [initialCoupon, coupon]);

  // Rascunho local (sem os CPFs) para não perder o que já foi digitado.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
      if (d) setF((x) => ({ ...x, email: d.email ?? "", phone: d.phone ?? "", name: d.name ?? "", pickupSelf: d.pickupSelf ?? true, pickupName: d.pickupName ?? "", pickupPhone: d.pickupPhone ?? "" }));
    } catch {}
  }, []);

  // Recuperação: remonta a sacola e o contato (o CPF a pessoa digita de novo) e segue gravando no mesmo checkout.
  useEffect(() => {
    if (!recovery) return;
    try { window.history.replaceState(null, "", window.location.pathname); } catch {}
    if (recovery.completed) {
      setError("Essa compra já foi concluída. Veja o pedido em Meus pedidos.");
      return;
    }
    adoptCheckoutToken(recovery.token);
    cart.replace(recovery.lines, recovery.coupon);
    const c = recovery.contact;
    setF((x) => ({ ...x, name: c.name || x.name, email: c.email || x.email, phone: c.phone ? formatPhone(c.phone) : x.phone }));
    markCheckoutRecovered(recovery.token);
  }, [recovery]);

  // begin_checkout: uma vez, quando o orçamento da sacola chega.
  useEffect(() => {
    if (begun.current || !quote || !quote.lines.length) return;
    begun.current = true;
    track("begin_checkout", { value: quote.totals.totalCents / 100, currency: "BRL", coupon: quote.discount?.code, items: itemsOf(quote.lines) });
  }, [quote]);
  useEffect(() => {
    try {
      const { cpf: _cpf, pickupCpf: _pc, ...rest } = f;
      localStorage.setItem(DRAFT, JSON.stringify(rest));
    } catch {}
  }, [f]);

  const set = (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (k === "cpf" || k === "pickupCpf") v = formatCpf(v);
    if (k === "phone" || k === "pickupPhone") v = formatPhone(v);
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _, ...rest }) => rest);
  };
  const blur = (k: TextKey) => () => setTouched((t) => ({ ...t, [k]: true }));
  const setSelf = (v: boolean) => { setF((x) => ({ ...x, pickupSelf: v })); setErrors({}); };

  const live = useMemo(() => ({ ...contactErrors(f), ...deliveryErrors(f) }), [f]);
  const err = (k: TextKey) => errors[k] ?? (touched[k] && f[k] ? live[k] : undefined);
  const ok = (k: TextKey) => !!f[k] && !live[k];

  const go = (n: Step) => {
    setStep(n);
    setMaxStep((m) => (n > m ? n : m));
    setError(null);
    requestAnimationFrame(() => document.getElementById(`etapa-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const pay = () => {
    setError(null);
    const all = { ...contactErrors(f), ...deliveryErrors(f) };
    if (Object.keys(all).length) {
      setErrors(all);
      go(Object.keys(contactErrors(f)).length ? 1 : 2);
      return;
    }
    if (cardForm) {
      const ce = { ...cardErrors({ number: card.cardNumber, holder: card.cardHolder, exp: card.cardExp, cvv: card.cardCvv }, rules.brands), ...billingErrors(billing) };
      if (Object.keys(ce).length) { setErrors(ce); setError("Confira os dados do cartão."); return; }
    }
    if (!accept) { setErrors({ accept: "Aceite os termos para continuar" }); return; }
    track("add_payment_info", { payment_type: method, value: total / 100, currency: "BRL", coupon: quote?.discount?.code, items: itemsOf(quote?.lines ?? []) });
    syncCheckout({ step: "payment", lines, coupon, method, contact: contact() }, true);
    setProcessing(true);
    const startedAt = Date.now();
    start(async () => {
      const fail = (msg: string, fields?: Record<string, string>) => {
        if (fields?.card && method === "card") track("payment_failed", { payment_type: "card", value: total / 100, currency: "BRL" });
        else track("checkout_error", { message: msg.slice(0, 120), payment_type: method });
        setProcessing(false);
        setError(msg);
        setErrors(fields ?? {});
        const keys = Object.keys(fields ?? {});
        if (keys.some((k) => STEP1.includes(k))) go(1);
        else if (keys.some((k) => !["coupon", "accept", "card"].includes(k) && !(k in EMPTY_BILLING) && !k.startsWith("card"))) go(2);
      };
      // Cartão: vira token direto na Pagar.me (chave pública). O número não passa pelo servidor da BORA.
      let cardPayload: { token: string; installments: number; billing: BillingState } | undefined;
      if (cardLive) {
        try {
          const token = await tokenizeCard({ number: card.cardNumber, holder: card.cardHolder, exp: card.cardExp, cvv: card.cardCvv });
          cardPayload = { token, installments: card.installments, billing };
        } catch (e) {
          return fail((e as Error).message, { card: "Confira os dados" });
        }
      }
      const res = await placeOrder({
        ...f, shippingId: "retirada", method, coupon: coupon || undefined, accept, lines, card: cardPayload,
        cardSim: cardForm && !cardLive ? { installments: Math.min(card.installments, inst.n), brand: cardBrand(card.cardNumber) ?? undefined, lastFour: card.cardNumber.replace(/\D/g, "").slice(-4) || undefined, holder: card.cardHolder.trim().toUpperCase().slice(0, 64) || undefined } : undefined,
        exclude: exclude.length ? exclude : undefined,
        expectedTotalCents: quote && !loading ? quote.totals.totalCents : undefined,
        checkoutToken: checkoutToken(false) ?? undefined,
      }).catch(() => ({ ok: false as const, error: "Não conseguimos criar o pedido agora. Tente de novo em instantes.", fields: undefined, dropDiscount: undefined }));
      if (!res.ok) {
        const drop = res.dropDiscount;
        if (drop) setExclude((x) => (x.includes(drop) ? x : [...x, drop]));
        // Cartão recusado: limpa o CVV para digitar de novo (o token não vale duas vezes).
        if (cardForm) setCard((c) => ({ ...c, cardCvv: "" }));
        return fail(res.error, res.fields);
      }
      // Efeito de processamento: no mínimo 5 s antes de seguir para o pagamento.
      const left = MIN_PROCESSING_MS - (Date.now() - startedAt);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      // A sacola só é esvaziada na página de obrigado: se o pagamento falhar, a pessoa volta com tudo.
      window.location.href = res.redirectUrl;
    });
  };

  // Carrinho abandonado: cada etapa concluída vai para o servidor (sem esperar o debounce).
  const contact = () => ({ name: f.name.trim(), email: f.email.trim(), phone: f.phone, cpf: f.cpf });
  const next = () => {
    if (step === 1) {
      const e = contactErrors(f);
      setErrors(e);
      if (!Object.keys(e).length) {
        track("add_contact_info", { value: total / 100, currency: "BRL", items: itemsOf(quote?.lines ?? []) });
        syncCheckout({ step: "contact", lines, coupon, contact: contact() }, true);
        go(2);
      }
    } else if (step === 2) {
      const e = deliveryErrors(f);
      setErrors(e);
      if (!Object.keys(e).length) {
        track("add_pickup_info", { pickup_self: f.pickupSelf, value: total / 100, currency: "BRL", items: itemsOf(quote?.lines ?? []) });
        syncCheckout({ step: "pickup", lines, coupon, contact: contact() }, true);
        go(3);
      }
    } else pay();
  };

  if (processing || redirecting) return <ProcessingOverlay method={method} />;
  if (!mounted) {
    return (
      <div className="min-h-[70svh] grid place-items-center text-center px-6">
        <div>
          <div className="mx-auto size-14 rounded-full border-4 border-sand-2 border-t-neon animate-spin" />
          <p className="mt-5 font-black uppercase tracking-tight text-xl">Preparando seu checkout…</p>
        </div>
      </div>
    );
  }
  if (lines.length === 0 && !pending) {
    return (
      <div className="wrap py-24 text-center">
        <h1 className="display text-5xl">Sacola vazia</h1>
        <Link href="/colecao/todos" className="btn btn-primary btn-lg mt-8">Voltar para a loja</Link>
      </div>
    );
  }

  const t = quote?.totals;
  const total = t?.totalCents ?? 0;
  const inst = installmentsFor(total, rules);
  const pixAllowed = t?.pixAllowed !== false;
  const pixSaving = t && pixAllowed ? Math.round(((t.subtotalCents - t.discountCents) * rules.pixDiscountPct) / 100) : 0;
  const savings = (t?.discountCents ?? 0) + (t?.pixDiscountCents ?? 0);
  const inCart = new Set((quote?.lines ?? []).map((l) => l.slug));
  // Sugestão: a outra peça à venda que ainda não está na sacola.
  const upsell = suggestions.filter((s) => !inCart.has(s.slug) && s.variants.some((v) => v.stock > 0)).sort((a, b) => a.priceCents - b.priceCents)[0];

  const payLabel = method === "pix" ? `Pagar com Pix · ${brl(total)}` : `Pagar ${brl(total)}${card.installments > 1 && card.installments <= inst.n ? ` em ${card.installments}x` : ""}`;
  const first = f.name.trim().split(/\s+/)[0] || "Você";
  const ctaLabel = step === 1 ? "Continuar para retirada" : step === 2 ? "Continuar para pagamento" : pending ? "Criando seu pedido…" : payLabel;

  // ---------------- resumo ----------------
  // Desktop: painel escuro ao lado. Celular: o mesmo resumo em versão clara, que abre no topo da tela.
  const renderSummary = (dark: boolean) => {
    const c = dark
      ? { text: "text-white", mute: "text-white/50", mute2: "text-white/60", mute3: "text-white/70", tile: "bg-white/5 ring-1 ring-white/10", panel: "bg-white/[0.06] ring-1 ring-white/10", accent: "text-neon", line: "border-white/10", issue: "bg-danger/30 text-white" }
      : { text: "text-ink", mute: "text-ink-3", mute2: "text-ink-2", mute3: "text-ink-2", tile: "bg-sand", panel: "bg-sand", accent: "text-neon-deep", line: "border-line", issue: "bg-danger/10 text-danger" };
    return (
    <div className={c.text}>
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
        {(quote?.lines ?? []).map((l) => (
          <div key={l.variantId} className="relative shrink-0 w-[118px] lg:w-[132px] snap-start">
            <div className={`relative aspect-[4/5] rounded-2xl overflow-hidden ${c.tile}`}>
              <Image src={l.image} alt="" fill sizes="132px" className="object-cover" />
              <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-neon text-black text-xs font-black grid place-items-center">{l.quantity}</span>
            </div>
            <p className="mt-2 text-sm font-bold leading-tight line-clamp-2">{l.name}</p>
            <p className={`text-[13px] ${c.mute}`}>{l.variantLabel}</p>
            <p className="text-sm font-bold mt-0.5">{brl(l.unitCents * l.quantity)}</p>
          </div>
        ))}
        {!quote ? <p className={`${c.mute} py-10`}>Calculando…</p> : null}
      </div>

      {quote?.stockIssues.length ? <div className={`mt-4 rounded-2xl p-4 text-sm font-bold ${c.issue}`}>{quote.stockIssues.map((s) => <p key={s}>{s}</p>)}</div> : null}

      <div className={`mt-6 rounded-2xl p-4 ${c.panel}`}>
        <p className={`text-xs font-bold uppercase tracking-widest ${c.accent}`}>Retirada no evento · grátis</p>
        <p className="mt-2 text-sm font-bold">{PICKUP.address}</p>
        <p className={`text-sm ${c.mute2}`}>{PICKUP.city} · {pickupWhen()}</p>
        {upsell ? <Upsell s={upsell} dark={dark} /> : null}
      </div>

      <div className={`mt-5 ${dark ? "[&_.text-neon-deep]:text-neon [&_.input]:bg-white/10 [&_.input]:border-white/15 [&_.input]:text-white [&_.input]:placeholder:text-white/40 [&_.btn-ghost]:text-white [&_.btn-ghost]:shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.3)] [&_button]:text-white/90" : ""}`}>
        <CouponField quote={quote} code={coupon} />
      </div>

      {quote && t ? (
        <dl className="mt-6 grid gap-2.5 text-sm">
          <div className={`flex justify-between ${c.mute3}`}><dt>Subtotal</dt><dd className={`${c.text} font-bold`}>{brl(t.subtotalCents)}</dd></div>
          {t.discountCents ? <div className={`flex justify-between gap-4 ${c.mute3}`}><dt className="min-w-0">{discountLabel(quote)}</dt><dd className={`${c.accent} font-bold whitespace-nowrap`}>− {brl(t.discountCents)}</dd></div> : null}
          {t.pixDiscountCents ? <div className={`flex justify-between ${c.mute3}`}><dt>Desconto Pix</dt><dd className={`${c.accent} font-bold`}>− {brl(t.pixDiscountCents)}</dd></div> : null}
          <div className={`flex justify-between ${c.mute3}`}><dt>Retirada</dt><dd className={`${c.text} font-bold`}>Grátis</dd></div>
          <div className={`flex justify-between items-baseline pt-4 mt-1 border-t ${c.line}`}>
            <dt className="font-bold">Total</dt>
            <dd className={`text-3xl font-black tracking-tight transition-opacity ${loading ? "opacity-60" : ""}`}>{brl(total)}</dd>
          </div>
          {savings > 0 ? <p className={`text-right text-sm font-bold ${c.accent}`}>Você está economizando {brl(savings)}</p> : null}
        </dl>
      ) : null}

      <ul className={`mt-8 grid gap-2.5 text-sm ${c.mute2}`}>
        <li className="flex items-center gap-2.5"><ShieldIcon size={18} /> Pagamento processado pela Pagar.me</li>
        <li className="flex items-center gap-2.5"><CheckIcon size={18} /> Confirmação e número do pedido por e-mail</li>
        <li className="flex items-center gap-2.5"><CheckIcon size={18} /> Troca de tamanho no próprio evento, se houver na grade</li>
      </ul>
      <PaymentIcons className="mt-6" />
    </div>
    );
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(44%,620px)] min-h-[calc(100svh-64px)] max-lg:bg-sand">
      {/* Resumo recolhível no celular (claro, abre para baixo) */}
      <div className="lg:hidden bg-white shadow-[0_0.5px_0_var(--color-line-strong)]">
        <button type="button" onClick={() => setSummaryOpen((s) => !s)} aria-expanded={summaryOpen} className="row-press w-full px-[var(--gutter)] h-[60px] flex items-center justify-between gap-3">
          <span className="flex items-center gap-3 min-w-0">
            <span className="flex -space-x-3 shrink-0">
              {(quote?.lines ?? []).slice(0, 3).map((l) => (
                <span key={l.variantId} className="relative size-9 rounded-full overflow-hidden ring-2 ring-white bg-sand"><Image src={l.image} alt="" fill sizes="36px" className="object-cover" /></span>
              ))}
            </span>
            <span className="text-[15px] font-bold truncate">{summaryOpen ? "Esconder resumo" : `Resumo · ${cartCount(lines)} ${cartCount(lines) === 1 ? "item" : "itens"}`}</span>
            <ChevronRight size={16} className={`shrink-0 text-ink-3 transition-transform duration-300 ${summaryOpen ? "-rotate-90" : "rotate-90"}`} />
          </span>
          <span className="text-lg font-black shrink-0 tabular-nums">{brl(total)}</span>
        </button>
        <div className={`grid transition-[grid-template-rows] duration-500 ease-out-expo ${summaryOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden" inert={!summaryOpen}><div className="px-[var(--gutter)] pb-6 pt-2">{renderSummary(false)}</div></div>
        </div>
      </div>

      {/* Formulário */}
      <form
        onSubmit={(e) => { e.preventDefault(); next(); }}
        onKeyDown={onEnter}
        noValidate
        className="min-w-0 px-[var(--gutter)] lg:pl-[max(var(--gutter),calc((100vw-1480px)/2+var(--gutter)))] lg:pr-14 pt-5 lg:py-10 pb-[calc(150px+env(safe-area-inset-bottom))] lg:pb-16"
      >
        <div className="max-w-2xl">
          <Progress step={step} />
          <h1 className="display text-[clamp(34px,4.4vw,56px)] mt-5 lg:mt-6">Falta pouco<span className="text-neon-deep">.</span></h1>
          {error ? <div id="checkout-erro" role="alert" className="mt-5 rounded-2xl bg-danger/10 text-danger p-4 font-bold text-sm scroll-mt-24">{error}</div> : null}

          <div className="mt-5 lg:mt-6 grid gap-3">
            <StepCard n={1} title="Seus dados" step={step} done={maxStep > 1 && !Object.keys(contactErrors(f)).length} onEdit={() => go(1)}
              summary={<>{f.name} · CPF {f.cpf}<br />{f.email} · {f.phone}</>}>
              <p className="text-sm text-ink-2 -mt-1 lg:-mt-2 mb-4 lg:mb-5">Quem está comprando. Os dados vão na nota fiscal e é por aqui que mandamos a confirmação.</p>
              <div className="ios-group grid grid-cols-6 gap-4">
                <Field label="Nome completo" error={err("name")} ok={ok("name")} className="col-span-6 sm:col-span-4">
                  <input className="input" autoComplete="name" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" value={f.name} onChange={set("name")} onBlur={blur("name")} aria-invalid={!!err("name")} placeholder="Nome e sobrenome" />
                </Field>
                <Field label="CPF" error={err("cpf")} ok={ok("cpf")} className="col-span-6 sm:col-span-2">
                  <input className="input tabular-nums" inputMode="numeric" autoComplete="off" enterKeyHint="next" value={f.cpf} onChange={set("cpf")} onBlur={blur("cpf")} placeholder="000.000.000-00" aria-invalid={!!err("cpf")} />
                </Field>
                <Field label="E-mail" error={err("email")} ok={ok("email")} className="col-span-6 sm:col-span-3">
                  <input className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" value={f.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={!!err("email")} placeholder="voce@email.com" />
                </Field>
                <Field label="Celular (WhatsApp)" error={err("phone")} ok={ok("phone")} className="col-span-6 sm:col-span-3">
                  <input className="input tabular-nums" type="tel" inputMode="tel" autoComplete="tel-national" enterKeyHint="go" value={f.phone} onChange={set("phone")} onBlur={blur("phone")} placeholder="(00) 00000-0000" aria-invalid={!!err("phone")} />
                </Field>
              </div>
              {emailSuggestion(f.email) ? (
                <button type="button" onClick={() => setF((x) => ({ ...x, email: emailSuggestion(x.email)! }))} className="pressable mt-2 min-h-11 text-left text-[15px]">
                  Você quis dizer <strong className="underline underline-offset-4">{emailSuggestion(f.email)}</strong>?
                </button>
              ) : null}
              <p className="mt-3 lg:mt-4 px-1 lg:px-0 text-[13px] lg:text-xs text-ink-3">Usamos o e-mail e o celular só para falar do seu pedido. Nada de spam.</p>
              <button className="hidden lg:flex btn btn-primary btn-lg mt-6">Continuar para retirada</button>
            </StepCard>

            <StepCard n={2} title="Retirada" step={step} done={maxStep > 2 && !Object.keys(deliveryErrors(f)).length} onEdit={() => go(2)}
              summary={<>Quem retira: {f.pickupSelf ? <>{f.name} (você)</> : <>{f.pickupName} · CPF {f.pickupCpf}</>}<br />{PICKUP.address} · {pickupWhen()}</>}>
              <div className="rounded-2xl bg-white ring-1 ring-line lg:bg-sand lg:ring-0 p-5 sm:p-6 relative overflow-hidden">
                <span className="chip chip-neon">Sem envio pelo correio</span>
                <p className="mt-3 text-xl font-black uppercase tracking-tight">Retirada no evento</p>
                <p className="mt-2 text-[15px] leading-relaxed"><strong>{PICKUP.address}</strong><br /><span className="text-ink-2">{PICKUP.city}</span></p>
                <p className="mt-1.5 text-sm text-ink-2">{pickupWhen()} (abertura da casa às {PICKUP.opens}, encerramento às {PICKUP.closes}).</p>
                <a href={PICKUP.mapsUrl} target="_blank" rel="noopener noreferrer" className="pressable mt-2 -mb-2 inline-flex items-center h-11 text-[15px] font-bold underline underline-offset-4">Ver no mapa</a>
              </div>

              <p className="mt-7 text-sm font-bold">Quem vai retirar as peças?</p>
              {/* Controle segmentado (iOS) */}
              <Segmented className="mt-3" label="Quem vai retirar" value={f.pickupSelf} onChange={setSelf}
                options={[{ value: true, label: "Eu mesmo", sub: `${first}, com documento` }, { value: false, label: "Outra pessoa", sub: "Amigo ou familiar" }]} />

              {f.pickupSelf ? (
                <p className="mt-4 px-1 lg:px-0 text-sm text-ink-2">Leve um documento com foto e o ID do pedido (está no e-mail de confirmação e na tela de obrigado).</p>
              ) : (
                <div className="mt-5 animate-rise">
                  <div className="ios-group grid grid-cols-6 gap-4">
                    <Field label="Nome completo de quem retira" error={err("pickupName")} ok={ok("pickupName")} className="col-span-6 sm:col-span-4">
                      <input className="input" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" placeholder="Nome e sobrenome" value={f.pickupName} onChange={set("pickupName")} onBlur={blur("pickupName")} aria-invalid={!!err("pickupName")} />
                    </Field>
                    <Field label="CPF" error={err("pickupCpf")} ok={ok("pickupCpf")} className="col-span-6 sm:col-span-2">
                      <input className="input tabular-nums" inputMode="numeric" autoComplete="off" enterKeyHint="next" value={f.pickupCpf} onChange={set("pickupCpf")} onBlur={blur("pickupCpf")} placeholder="000.000.000-00" aria-invalid={!!err("pickupCpf")} />
                    </Field>
                    <Field label="Celular (WhatsApp) de quem retira" error={err("pickupPhone")} ok={ok("pickupPhone")} className="col-span-6 sm:col-span-3">
                      <input className="input tabular-nums" type="tel" inputMode="tel" autoComplete="off" enterKeyHint="go" value={f.pickupPhone} onChange={set("pickupPhone")} onBlur={blur("pickupPhone")} placeholder="(00) 00000-0000" aria-invalid={!!err("pickupPhone")} />
                    </Field>
                  </div>
                  <p className="mt-3 px-1 lg:px-0 text-[13px] lg:text-xs text-ink-3 leading-relaxed">Essa pessoa leva um documento com foto e o ID do pedido. O passe de retirada chega no seu e-mail: é só encaminhar. Só ela ou você podem retirar.</p>
                </div>
              )}
              <button className="hidden lg:flex btn btn-primary btn-lg mt-7">Continuar para pagamento</button>
            </StepCard>

            <StepCard n={3} title="Pagamento" step={step} done={false} onEdit={() => go(3)}>
              {!methods.length ? <p className="rounded-2xl bg-sand p-5 font-bold">Os pagamentos estão pausados por alguns minutos. Tente de novo em instantes ou fale com a gente no WhatsApp.</p> : null}
              {methods.length ? (
                <Segmented label="Forma de pagamento" value={method} onChange={setMethod}
                  options={([
                    { value: "pix", icon: <PixIcon size={18} />, label: "Pix", sub: <span className={pixAllowed && rules.pixDiscountPct > 0 ? "font-black text-neon-deep" : ""}>{pixAllowed && rules.pixDiscountPct > 0 ? `−${rules.pixDiscountPct}%` : "Na hora"}</span> },
                    { value: "card", icon: <CardIcon size={18} />, label: "Cartão", sub: inst.n > 1 ? `${inst.n}x sem juros` : "À vista" },
                  ] as { value: Method; icon: React.ReactNode; label: string; sub: React.ReactNode }[]).filter((m) => methods.includes(m.value))} />
              ) : null}

              {/* Celular: Pix num cartão branco; cartão direto nas listas agrupadas (sem caixa por fora). */}
              <div className={`mt-4 lg:mt-5 rounded-2xl animate-rise ${method === "pix" ? "bg-white ring-1 ring-line lg:bg-sand lg:ring-0 p-5" : "sm:bg-white sm:ring-1 sm:ring-line lg:bg-sand lg:ring-0 sm:p-5"} ${methods.length ? "" : "hidden"}`} key={method}>
                {method === "pix" ? (
                  <>
                    <p className="font-bold">{pixAllowed && rules.pixDiscountPct > 0 ? <>Aprovação na hora e {rules.pixDiscountPct}% de desconto</> : "Aprovação na hora"}</p>
                    {pixSaving ? <p className="mt-1 text-sm">Você economiza <strong>{brl(pixSaving)}</strong> pagando com Pix.</p> : null}
                    {!pixAllowed && quote?.discount ? <p className="mt-1 text-sm">O desconto “{quote.discount.title}” não soma com os {rules.pixDiscountPct}% do Pix.</p> : null}
                    <p className="mt-2 text-sm text-ink-2">Ao confirmar, aparecem o QR Code e o copia-e-cola. O QR Code vale {rules.pixExpiresMinutes} minutos. Assim que o Pix cair, você vai direto para a confirmação do pedido.</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold px-1 sm:px-0">Em até {inst.n}x sem juros</p>
                    <div className="mt-3 sm:mt-4"><CardFields card={card} setCard={setCard} billing={billing} setBilling={setBilling} errors={errors} total={total} maxInstallments={inst.n} simulated={gateway === "simulado"} /></div>
                  </>
                )}
                <PaymentIcons className={`mt-4 ${method === "card" ? "px-1 sm:px-0" : ""}`} only={method === "pix" ? ["Pix"] : rules.brands.map((b) => BRAND_NAMES[b])} />
              </div>

              {/* Leve junto (order bump): logo antes de pagar, um toque adiciona ao pedido. */}
              {(quote?.extras ?? []).map((o) => <ExtraOffer key={o.productId} offer={o} location="checkout" className="mt-5 lg:mt-6" />)}

              <label className={`mt-5 lg:mt-6 flex items-start gap-3 text-sm cursor-pointer rounded-2xl bg-white ring-1 p-4 lg:p-0 lg:bg-transparent lg:ring-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink ${errors.accept ? "ring-danger/50" : "ring-line"}`}>
                <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setErrors(({ accept: _, ...r }) => r); }} className="sr-only" />
                {/* Marcador redondo no jeito iOS */}
                <span aria-hidden className={`mt-px size-6 shrink-0 rounded-full grid place-items-center transition-colors ${accept ? "bg-neon text-black ring-1 ring-ink" : errors.accept ? "ring-2 ring-danger" : "ring-[1.5px] ring-line-strong"}`}>{accept ? <CheckIcon size={14} /> : null}</span>
                <span className={`leading-relaxed ${errors.accept ? "text-danger font-bold" : "text-ink-2"}`}>
                  Li e aceito os <Link href="/politicas/termos" target="_blank" className="underline">termos</Link>, a <Link href="/politicas/trocas-e-devolucoes" target="_blank" className="underline">política de trocas</Link> e o <Link href="/politicas/privacidade" target="_blank" className="underline">aviso de privacidade</Link>.
                </span>
              </label>

              <button className="hidden lg:flex btn btn-primary btn-lg btn-block mt-6 h-16 text-base" disabled={pending || !methods.length || !quote || !!quote.stockIssues.length}>
                <LockIcon size={18} /> {pending ? "Criando seu pedido…" : payLabel}
              </button>
              <p className="mt-3 text-center text-[13px] lg:text-xs text-ink-3">A BORA não vê nem guarda os dados do seu cartão.</p>
            </StepCard>
          </div>
        </div>

        {/* Barra fixa no celular */}
        <div className={`lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/85 backdrop-blur-xl backdrop-saturate-150 shadow-[0_-0.5px_0_var(--color-line-strong)] px-[var(--gutter)] pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out-expo ${keyboard ? "translate-y-[120%]" : ""}`}>
          <div className="flex items-center justify-between gap-3 text-sm mb-2">
            <span className="text-ink-3 truncate">{step < 3 ? `Etapa ${step} de 3` : method === "pix" ? `Pix · economiza ${brl(pixSaving)}` : `${inst.n}x de ${brl(inst.each)}`}</span>
            <span className="font-black text-lg tabular-nums shrink-0">{brl(total)}</span>
          </div>
          <button className="btn btn-primary btn-block h-[54px] text-base" disabled={pending || (step === 3 && (!methods.length || !quote || !!quote.stockIssues.length))}>
            {step === 3 ? <LockIcon size={18} /> : null} {ctaLabel}
          </button>
        </div>
      </form>

      {/* Painel imersivo */}
      <aside className="hidden lg:block relative bg-ink overflow-hidden">
        <Image src="/img/marca/pattern-bora-white.webp" alt="" width={1200} height={1340} className="absolute -right-48 -bottom-56 w-[760px] opacity-[0.05] pointer-events-none select-none" />
        <div className="sticky top-0 max-h-svh overflow-y-auto no-scrollbar px-12 py-10 relative">
          <div className="flex items-center justify-between">
            <p className="text-white text-xl font-black uppercase tracking-tight">Seu pedido</p>
            <Link href="/carrinho" className="text-sm text-white/60 hover:text-white underline underline-offset-4">Editar sacola</Link>
          </div>
          <div className="mt-6">{renderSummary(true)}</div>
        </div>
      </aside>
    </div>
  );
}

// Sugestão da outra peça (adiciona com um toque).
function Upsell({ s, dark = true }: { s: Suggestion; dark?: boolean }) {
  const [pick, setPick] = useState<string | null>(s.variants.length === 1 ? s.variants[0].id : null);
  return (
    <div className={`mt-4 pt-4 border-t flex gap-3 items-center ${dark ? "border-white/10" : "border-line"}`}>
      <div className={`relative size-16 rounded-xl overflow-hidden shrink-0 ${dark ? "bg-white/10" : "bg-white"}`}><Image src={s.image} alt="" fill sizes="64px" className="object-cover" /></div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${dark ? "text-white/60" : "text-ink-2"}`}>Leve as duas peças da Volta 18K</p>
        <p className="text-sm font-bold truncate">{s.name} · {brl(s.priceCents)}</p>
        {s.variants.length > 1 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {s.variants.map((v) => (
              <button key={v.id} type="button" disabled={v.stock <= 0} onClick={() => setPick(v.id)} className={`h-9 lg:h-7 min-w-9 lg:min-w-8 px-2 rounded-full text-xs lg:text-[11px] font-bold ring-1 transition disabled:opacity-30 ${dark ? (pick === v.id ? "bg-white text-black ring-white" : "ring-white/25 text-white") : (pick === v.id ? "bg-ink text-white ring-ink" : "ring-line-strong bg-white text-ink")}`}>{v.label}</button>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" disabled={!pick} onClick={() => pick && cart.add(pick, 1, false, { itemId: s.slug, name: s.name, size: s.variants.find((v) => v.id === pick)?.label, priceCents: s.priceCents })} className="pressable size-11 shrink-0 rounded-full bg-neon text-black grid place-items-center disabled:opacity-30" aria-label={`Adicionar ${s.name}`}>
        <PlusIcon size={18} />
      </button>
    </div>
  );
}

// Itens no formato do GA4 (sem dados pessoais).
function itemsOf(lines: { productId: string; name: string; variantLabel: string; unitCents: number; quantity: number }[]) {
  return lines.map((l) => ({ item_id: l.productId, item_name: l.name, item_variant: l.variantLabel, price: l.unitCents / 100, quantity: l.quantity }));
}
