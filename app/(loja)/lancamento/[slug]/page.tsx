import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QuickBuy from "@/components/product/QuickBuy";
import { getProduct } from "@/lib/server/catalog";
import { brl, installments } from "@/lib/money";
import { STORE } from "@/lib/config";
import { ArrowIcon, CheckIcon, PlusIcon } from "@/components/ui/Icons";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, faqLd, pageMeta } from "@/lib/seo";
import { getPaymentRules } from "@/lib/server/settings";
import { installmentsFor, paymentSentence, pixBadge, type PaymentRules } from "@/lib/payment-rules";

// Página de vendas. Hoje só o Kit letz BORA tem página de lançamento.
const PAGES = ["kit-letz-bora"];

export async function generateMetadata({ params }: PageProps<"/lancamento/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!PAGES.includes(slug)) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  return pageMeta({
    title: "Kit letz BORA · Lançamento",
    description: "Camiseta Dri-Fit, Boné Five Panel e Meia BORA num kit só, com preço de kit. Pix ou cartão pela Pagar.me.",
    path: `/lancamento/${slug}`,
  });
}

const faqOf = (rules: PaymentRules) => [
  { q: "Posso escolher a cor de cada peça?", a: "Você escolhe a cor e o tamanho da camiseta (preta ou verde neon). O boné é preto e a meia vem na cor da camiseta." },
  { q: "E se o tamanho não servir?", a: "Você tem 30 dias para trocar o tamanho. A primeira troca é por nossa conta. Veja a política de trocas." },
  { q: "Qual o prazo de entrega?", a: "Enviamos em até 2 dias úteis após o pagamento. O prazo do transporte aparece no checkout pelo seu CEP." },
  { q: "A meia serve no meu pé?", a: "O kit sai com a meia 39-43. Se você calça de 34 a 38, é só pedir a troca depois da entrega, sem custo." },
  { q: "Como pago?", a: `${paymentSentence(rules)}. O pagamento é processado pela Pagar.me.` },
];

export default async function SalesPage({ params }: PageProps<"/lancamento/[slug]">) {
  const { slug } = await params;
  if (!PAGES.includes(slug)) notFound();
  const [kit, shirt, cap, sock] = await Promise.all([getProduct("kit-letz-bora"), getProduct("camiseta-dri-fit-bora"), getProduct("bone-five-panel-bora"), getProduct("meia-bora-cano-alto")]);
  if (!kit || !shirt || !cap || !sock) notFound();

  const separate = shirt.priceCents + cap.priceCents + sock.priceCents;
  const saving = separate - kit.priceCents;
  const left = kit.variants.reduce((s, v) => s + v.stock, 0);
  const rules = await getPaymentRules();
  const FAQ = faqOf(rules);
  const pixText = pixBadge(rules);
  const inst = rules.cardEnabled ? installmentsFor(kit.priceCents, rules) : { n: 1, each: kit.priceCents };
  const pieces = [
    { p: shirt, img: shirt.images[2]?.url ?? shirt.images[0].url, t: "Camiseta Dri-Fit", d: "Leve, seca rápido e tem o letz BORAAA!! nas costas. Preta ou verde neon." },
    { p: cap, img: cap.images[0].url, t: "Boné Five Panel", d: "Ultraleve, aba flexível e as curvas de nível da marca na lateral." },
    { p: sock, img: sock.images[0].url, t: "Meia Cano Alto", d: "Compressão leve no arco e calcanhar reforçado. Na cor da camiseta." },
  ];

  return (
    <>
      <JsonLd data={[faqLd(FAQ), breadcrumbLd([{ name: "Início", path: "/" }, { name: "Kit letz BORA", path: `/lancamento/${slug}` }])]} />
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-white">
        <Image src="/img/marca/pattern-bora-green.webp" alt="" width={1400} height={1560} className="absolute -right-56 -top-40 w-[1000px] opacity-[0.16] pointer-events-none" priority />
        <div className="wrap relative grid lg:grid-cols-2 gap-10 items-center py-14 lg:py-20">
          <div>
            <span className="chip chip-neon">Lançamento · Drop 2026</span>
            <h1 className="display text-[clamp(52px,8vw,128px)] mt-6">Kit<br />letz <span className="text-neon">BORA</span></h1>
            <p className="mt-6 text-xl text-white/75 max-w-md">Camiseta, boné e meia. O uniforme completo do movimento, com preço de kit.</p>
            <div className="mt-8 flex items-end gap-4 flex-wrap">
              <div>
                <p className="text-white/50 line-through">{brl(separate)} separado</p>
                <p className="text-5xl font-black tracking-tight">{brl(kit.priceCents)}</p>
                <p className="text-white/70 mt-1">{inst.n > 1 ? <>{inst.n}x de {brl(inst.each)} sem juros{pixText ? " · " : null}</> : null}{pixText ? <strong className="text-neon">{pixText}</strong> : null}</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#comprar" className="btn btn-neon btn-lg">Quero o kit <ArrowIcon size={18} /></a>
              <a href="#pecas" className="btn btn-lg text-white ring-1 ring-white/30 hover:ring-white">Ver as peças</a>
            </div>
            {left > 0 && left <= 60 ? <p className="mt-6 text-sm font-bold text-neon">⚡ Restam {left} kits nesta edição</p> : null}
          </div>
          <div className="relative aspect-square">
            <div className="absolute inset-[6%] rounded-[40px] overflow-hidden rotate-[-3deg] shadow-2xl">
              <Image src={kit.images[0].url} alt={kit.images[0].alt} fill sizes="(min-width:1024px) 45vw, 90vw" className="object-cover" priority />
            </div>
            <div className="absolute right-0 bottom-[4%] w-[38%] aspect-square rounded-[28px] overflow-hidden rotate-[6deg] ring-4 ring-ink shadow-2xl">
              <Image src={cap.images[0].url} alt={cap.images[0].alt || cap.name} fill sizes="20vw" className="object-cover" />
            </div>
            <Image src="/img/marca/sticker-letz-bora-green.webp" alt="" width={260} height={180} className="absolute left-0 top-0 w-[30%] -rotate-12 drop-shadow-2xl" />
          </div>
        </div>
      </section>

      {/* PEÇAS */}
      <section id="pecas" className="wrap mt-24 scroll-mt-24">
        <p className="eyebrow">O que vem no kit</p>
        <h2 className="display text-[clamp(36px,5.4vw,76px)] mt-3">Três peças.<br /><span className="mark">Uma largada.</span></h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {pieces.map((x, i) => (
            <div key={x.t} className="card overflow-hidden">
              <div className="relative aspect-[4/3] bg-sand">
                <Image src={x.img} alt={x.t} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" />
                <span className="absolute left-4 top-4 size-9 rounded-full bg-neon font-black grid place-items-center">{i + 1}</span>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-baseline"><p className="text-xl font-black uppercase tracking-tight">{x.t}</p><p className="text-ink-3 line-through text-sm">{brl(x.p.priceCents)}</p></div>
                <p className="mt-2 text-ink-2">{x.d}</p>
                <Link href={`/produto/${x.p.slug}`} className="mt-4 inline-block text-sm font-bold underline underline-offset-4">Ver a peça</Link>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-[28px] bg-neon p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xl sm:text-2xl font-black uppercase tracking-tight">Separado: <span className="line-through opacity-60">{brl(separate)}</span> · No kit: {brl(kit.priceCents)}</p>
          <p className="chip chip-ink h-10 px-5 text-sm">Você economiza {brl(saving)}</p>
        </div>
      </section>

      {/* PARA QUEM */}
      <section className="wrap mt-28 grid lg:grid-cols-2 gap-10 items-center">
        <div className="relative aspect-[4/5] rounded-[32px] overflow-hidden">
          <Image src="/img/marca/bora-house-1280.webp" alt="Corredores da BORA em prova" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
        </div>
        <div>
          <p className="eyebrow">Para quem é</p>
          <h2 className="display text-[clamp(36px,5vw,72px)] mt-3">Você não precisa<br />estar pronto.</h2>
          <p className="mt-5 text-lg text-ink-2 max-w-lg">Na BORA, todo motivo importa. Pace importa. Propósito também. O kit é para quem:</p>
          <ul className="mt-8 grid gap-4">
            {["Vai fazer o primeiro 5k e quer chegar vestido de BORA", "Treina toda semana e quer o uniforme completo do grupo", "Vai para a prova e quer ser visto de longe pela torcida", "Quer dar um presente para quem começou a correr"].map((t) => (
              <li key={t} className="flex gap-3 text-lg"><span className="mt-1 size-6 shrink-0 rounded-full bg-neon grid place-items-center"><CheckIcon size={14} /></span>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="mt-28 bg-neon">
        <div className="wrap py-20 text-center">
          <p className="display text-[clamp(32px,5.6vw,88px)] max-w-5xl mx-auto">“Ir sozinho é possível. Irmos junto transforma.”</p>
          <p className="mt-6 font-bold uppercase tracking-widest text-sm">Manifesto BORA</p>
        </div>
      </section>

      {/* COMPRA */}
      <section id="comprar" className="wrap mt-24 scroll-mt-24">
        <div className="rounded-[36px] bg-ink text-white overflow-hidden grid lg:grid-cols-2">
          <div className="relative min-h-[360px]">
            <Image src={kit.images[1]?.url ?? kit.images[0].url} alt={(kit.images[1] ?? kit.images[0]).alt || kit.name} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="p-8 sm:p-12">
            <p className="eyebrow text-neon">Monte seu kit</p>
            <h2 className="text-4xl font-black uppercase tracking-tight mt-3">Kit letz BORA</h2>
            <p className="mt-2 text-white/70">Escolha a cor e o tamanho da camiseta.</p>
            <p className="mt-6 text-4xl font-black">{brl(kit.priceCents)} <span className="text-lg text-white/40 line-through font-bold">{brl(separate)}</span></p>
            <div className="mt-8"><QuickBuy p={kit} dark /></div>
            <p className="mt-5 text-sm text-white/60">Frete grátis acima de {brl(STORE.freeShippingCents)} · Troca em 30 dias · Pagamento seguro</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="wrap mt-24 max-w-3xl">
        <p className="eyebrow">Perguntas frequentes</p>
        <h2 className="display text-[clamp(32px,4.4vw,56px)] mt-3">Ficou alguma dúvida?</h2>
        <div className="mt-8 border-t border-line divide-y divide-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-6">
              <summary className="flex items-center justify-between gap-6 cursor-pointer list-none text-lg font-bold">{f.q}<PlusIcon className="shrink-0 transition-transform group-open:rotate-45" /></summary>
              <p className="mt-3 text-ink-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
