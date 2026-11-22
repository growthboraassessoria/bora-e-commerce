import { INDEXABLE, SALES_OPEN } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PresaleHero3D from "@/components/presale/Hero3D";
import PresaleBuy, { type BuySize } from "@/components/presale/PresaleBuy";
import PaymentIcons from "@/components/ui/PaymentIcons";
import PickupMap from "@/components/presale/PickupMap";
import { getProduct } from "@/lib/server/catalog";
import { PICKUP, PRESALE } from "@/lib/presale";
import { PRESALE_FIELDS, PRESALE_ROUTE } from "@/lib/cms-schema";
import { getSeo, getSetting, getText } from "@/lib/builder-content";
import { STORE } from "@/lib/config";
import { brl } from "@/lib/money";
import { ArrowIcon, CheckIcon, PlusIcon } from "@/components/ui/Icons";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_NAME, breadcrumbLd, faqLd, itemListLd } from "@/lib/seo";
import { getPaymentRules } from "@/lib/server/settings";
import { paymentSentence, pixBadge } from "@/lib/payment-rules";

const def = (key: string) => PRESALE_FIELDS.find((f) => f.key === key)?.def ?? "";
const t = (key: string) => getText(PRESALE_ROUTE, key, def(key));
const lines = async (key: string) => {
  const v = await getText(PRESALE_ROUTE, key, def(key).split("\n").filter(Boolean));
  return (Array.isArray(v) ? v : String(v).split("\n")).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]);
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo(PRESALE_ROUTE, {
    title: "Pré-venda Volta 18K · Edição Pampulha",
    description: "Pré-venda BORA Volta 18K, Edição Pampulha: camiseta LETZ BORA de algodão e regata cropped preta com estampa neon. Garanta online e retire no evento.",
    og_title: "BORA · Pré-venda Volta 18K",
  });
  // Título, descrição, imagem, canonical e noindex podem vir do Builder (BORA OS); o resto é padrão da loja.
  const canonical = seo.canonical ?? PRESALE.path;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: SITE_NAME,
      url: canonical,
      title: seo.og_title,
      description: seo.og_description,
      images: [seo.og_image ? { url: seo.og_image } : { url: "/img/produtos/c1-cropped-preta-duo-1600.webp", width: 1600, height: 1000, alt: "Camiseta LETZ BORA e regata cropped da pré-venda Volta 18K" }],
    },
    twitter: { card: "summary_large_image", title: seo.og_title, description: seo.og_description },
    robots: seo.noindex || !INDEXABLE ? { index: false, follow: false } : undefined,
  };
}

// Estoque e conteúdo mudam: a página é refeita a cada 30 s (e na hora, quando o OS publica).
export const revalidate = 30;

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG"];

export default async function PresalePage() {
  const rules = await getPaymentRules();
  const products = (await Promise.all(PRESALE.productSlugs.map((s) => getProduct(s)))).filter((p) => !!p);
  if (products.length !== PRESALE.productSlugs.length) notFound();
  const [shirt, cropped] = products;

  const [chip, edition, eyebrow, titleA, titleB, sub, cta, stepsTitle, steps, shirtStory, croppedStory, pickupTitle, pickupNote, faqCms, finalTitle, disclaimer, open, eventDate] = await Promise.all([
    t("hero.chip"), t("hero.edition"), t("hero.eyebrow"), t("hero.title_a"), t("hero.title_b"), t("hero.sub"), t("hero.cta"),
    t("steps.title"), lines("steps.items"), t("shirt.story"), t("cropped.story"), t("pickup.title"), t("pickup.note"), lines("faq"),
    t("final.title"), t("disclaimer"), getSetting<boolean>("presale.open", true), getSetting<string | null>("presale.event_date", PRESALE.eventDate),
  ]);
  const when = eventDate ? `Dia ${eventDate}, das ${PICKUP.opens} às ${PICKUP.closes}` : `No dia da prova, das ${PICKUP.opens} às ${PICKUP.closes}`;

  const sizesOf = (p: typeof shirt): BuySize[] =>
    [...p.variants].sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)).map((v) => ({ id: v.id, size: v.size, stock: v.stock }));

  const blocks = [
    { p: shirt, n: "01", kicker: "Algodão · Unissex", line: "Running is a lifestyle.", story: shirtStory, main: shirt.images[0], side: [shirt.images[1], shirt.images[2], shirt.images[3]] },
    { p: cropped, n: "02", kicker: "Performance · Quick dry", line: "Beyond the pace.", story: croppedStory, main: cropped.images[0], side: [cropped.images[1], cropped.images[3], cropped.images[5]] },
  ];

  const faq = faqCms.length
    ? faqCms.map(([q, a]) => ({ q, a: a ?? "" }))
    : [
        { q: "Como funciona a pré-venda?", a: "Você escolhe o tamanho e paga agora. A sua peça fica separada no seu nome e você retira no evento." },
        { q: "Onde e quando eu retiro?", a: `${PICKUP.address}, ${PICKUP.city}. ${when}. ${PICKUP.bring}` },
        { q: "Vocês enviam pelo correio?", a: "Não. A entrega é só no evento, no dia da prova." },
        { q: "Vai ter venda no local?", a: "Sim, enquanto houver peças. Quem garante na pré-venda já tem a sua separada." },
        { q: "E se o tamanho não servir?", a: "Na retirada você pode trocar pelo tamanho que precisar, se ele ainda estiver na grade." },
        { q: "Quais as formas de pagamento?", a: `${paymentSentence(rules)}, pela Pagar.me.` },
        { q: "É produto oficial da prova?", a: "Não. É uma coleção da BORA inspirada na volta mais famosa de BH, sem ligação com a organização do evento." },
      ];

  return (
    <>
      <JsonLd data={[faqLd(faq), itemListLd("Pré-venda Volta 18K", products), breadcrumbLd([{ name: "Início", path: "/" }, { name: "Pré-venda Volta 18K", path: PRESALE.path }])]} />
      {/* ================= HERO ================= */}
      <section className="relative isolate overflow-hidden bg-[#070707] text-white min-h-[calc(100svh-100px)] flex flex-col">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_65%_45%,rgba(206,255,0,0.10),transparent_70%)]" />
        <Image src="/img/marca/pattern-bora-white.webp" alt="" width={1400} height={1560} priority className="absolute -left-60 -top-40 w-[1100px] opacity-[0.035] -z-10 pointer-events-none select-none" />
        <PresaleHero3D images={[shirt.images[0].url.replace("-1600", "-800"), cropped.images[0].url.replace("-1600", "-800")]} />
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(0deg,#070707_0%,rgba(7,7,7,0.92)_45%,rgba(7,7,7,0)_72%)] lg:bg-[linear-gradient(90deg,#070707_0%,rgba(7,7,7,0.9)_34%,rgba(7,7,7,0)_58%)]" />

        <div className="wrap relative flex-1 flex flex-col justify-between py-8 lg:py-10 pointer-events-none">
          <div className="flex flex-wrap items-center gap-2 animate-rise">
            <span className="chip chip-neon"><span className="size-1.5 rounded-full bg-black animate-pulse" /> {!open ? "Pré-venda encerrada" : SALES_OPEN ? chip : "Pré-venda em breve"}</span>
            <span className="chip bg-white/10 text-white">{edition}</span>
            <span className="chip bg-white/10 text-white">Edição limitada</span>
          </div>

          <div className="mt-[34svh] lg:mt-6 max-w-[760px]">
            <p className="eyebrow text-white/50">{eyebrow}</p>
            <h1 className="display mt-3 text-[clamp(72px,12vw,200px)] leading-[0.82]">
              {titleA}<br />
              <span className="text-transparent [-webkit-text-stroke:2px_#ceff00] lg:[-webkit-text-stroke:3px_#ceff00]">{titleB}</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg sm:text-xl text-white/75 leading-relaxed">{sub}</p>
            <div className="mt-8 flex flex-wrap gap-3 pointer-events-auto">
              <a href="#pecas" className="btn btn-neon btn-lg">{cta} <ArrowIcon size={18} /></a>
              <a href="#retirada" className="btn btn-lg text-white ring-1 ring-white/25 hover:ring-white">Onde retirar</a>
            </div>
          </div>

          <div className="mt-10 grid sm:grid-cols-[1fr_auto] gap-6 items-end pointer-events-auto">
            <a href="#retirada" className="max-w-md rounded-[22px] bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-md p-5 hover:bg-white/[0.09] transition-colors">
              <p className="text-xs font-bold uppercase tracking-widest text-neon">Retirada no evento</p>
              <p className="mt-2 font-bold">{PICKUP.address}</p>
              <p className="text-sm text-white/60">{PICKUP.city} · {when}</p>
            </a>
            <div className="hidden lg:flex gap-8 text-sm rounded-[22px] bg-black/50 backdrop-blur-md px-6 py-4">
              <div><p className="text-3xl font-black">02</p><p className="text-white/50">modelos</p></div>
              <div><p className="text-3xl font-black">{PICKUP.opens}</p><p className="text-white/50">abertura</p></div>
              <div><p className="text-3xl font-black">18K</p><p className="text-white/50">de volta</p></div>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-black/40 overflow-hidden h-12 flex items-center">
          <div className="flex whitespace-nowrap animate-marquee text-[13px] font-black uppercase tracking-[0.18em] text-white/80">
            {Array.from({ length: 2 }).map((_, k) => (
              <div key={k} className="flex shrink-0">
                {["From: Dry Lake", "To: all over the world", "Running is a lifestyle", "Beyond the pace", "letz BORAAA!!", "Pré-venda Volta 18K"].map((x) => (
                  <span key={x + k} className="px-8 flex items-center gap-8">{x}<span className="text-neon">⚡</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section id="como-funciona" className="wrap mt-20 scroll-mt-24">
        <p className="eyebrow">Como funciona</p>
        <h2 className="display text-[clamp(36px,5vw,72px)] mt-3 max-w-3xl">{stepsTitle}</h2>
        <ol className="mt-10 grid md:grid-cols-3 gap-4">
          {steps.map(([title, text], i) => (
            <li key={title} className="card p-7 relative overflow-hidden">
              <span className="absolute -right-3 -top-6 text-[120px] font-black text-ink/[0.04] leading-none select-none">{i + 1}</span>
              <span className="size-10 rounded-full bg-neon grid place-items-center font-black">{i + 1}</span>
              <p className="mt-5 text-xl font-black uppercase tracking-tight">{title}</p>
              <p className="mt-2 text-ink-2 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= PEÇAS ================= */}
      <section id="pecas" className="mt-24 scroll-mt-20">
        {blocks.map((b, i) => (
          <div key={b.p.slug} className={`wrap grid grid-cols-1 [&>*]:min-w-0 lg:grid-cols-2 gap-8 lg:gap-14 items-start ${i ? "mt-24" : ""}`}>
            <div className={`grid grid-cols-3 gap-3 ${i % 2 ? "lg:order-2" : ""}`}>
              <div className="col-span-3 relative aspect-[4/5] rounded-[32px] overflow-hidden bg-sand">
                <Image src={b.main.url} alt={b.main.alt} fill sizes="(min-width:1024px) 48vw, 100vw" className="object-cover" />
                <span className="absolute left-5 top-5 chip chip-ink">{b.n} · Volta 18K</span>
              </div>
              {b.side.filter(Boolean).map((im) => (
                <div key={im!.url} className="relative aspect-square rounded-[20px] overflow-hidden bg-sand">
                  <Image src={im!.url} alt={im!.alt} fill sizes="16vw" className="object-cover" />
                </div>
              ))}
            </div>
            <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
              <p className="eyebrow">{b.kicker}</p>
              <h2 className="display text-[clamp(40px,5vw,72px)] mt-3">{b.p.name}</h2>
              <p className="mt-2 text-2xl font-black text-ink-3 uppercase tracking-tight">{b.line}</p>
              <p className="mt-5 text-lg text-ink-2 leading-relaxed max-w-lg">{b.story}</p>
              <ul className="mt-5 grid grid-cols-2 gap-2">
                {b.p.highlights.map((h) => <li key={h} className="flex items-center gap-2 text-sm font-bold"><span className="size-5 rounded-full bg-neon grid place-items-center shrink-0"><CheckIcon size={12} /></span>{h}</li>)}
              </ul>
              <div className="mt-8 rounded-[28px] ring-1 ring-line p-6">
                <PresaleBuy name={b.p.name} productId={b.p.id} priceCents={b.p.priceCents} sizes={sizesOf(b.p)} open={open} />
                <PaymentIcons className="mt-5" />
              </div>
              <Link href={`/produto/${b.p.slug}`} className="mt-4 inline-block text-sm text-ink-3 underline underline-offset-4">Ficha completa e guia de medidas</Link>
            </div>
          </div>
        ))}
      </section>

      {/* ================= RETIRADA ================= */}
      <section id="retirada" className="wrap mt-28 scroll-mt-24">
        <div className="rounded-[36px] bg-ink text-white overflow-hidden grid lg:grid-cols-[1.1fr_1fr]">
          <div className="p-8 sm:p-14">
            <p className="eyebrow text-neon">Entrega</p>
            <h2 className="display text-[clamp(40px,5.4vw,80px)] mt-3">{pickupTitle}</h2>
            <p className="mt-5 text-lg text-white/70 max-w-lg">{pickupNote}</p>
            <dl className="mt-8 grid sm:grid-cols-2 gap-6">
              <div><dt className="text-xs font-bold uppercase tracking-widest text-white/50">Local</dt><dd className="mt-2 font-bold text-lg leading-snug">{PICKUP.address}<br /><span className="font-normal text-white/60 text-base">{PICKUP.city}</span></dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-widest text-white/50">Quando</dt><dd className="mt-2 font-bold text-lg leading-snug">{eventDate ? `Dia ${eventDate}` : "No dia da prova"}<br /><span className="font-normal text-white/60 text-base">Abertura às {PICKUP.opens} · encerramento às {PICKUP.closes}</span></dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-widest text-white/50">O que levar</dt><dd className="mt-2 text-white/80">{PICKUP.bring}</dd></div>
            </dl>
            <a href={PICKUP.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-neon btn-lg mt-8">Abrir no mapa <ArrowIcon size={18} /></a>
          </div>
          <div className="relative min-h-[380px] lg:min-h-[520px] bg-[#0f0f0f]">
            <PickupMap address={PICKUP.address} query={PICKUP.query} label="Retirada BORA" />
          </div>
        </div>
      </section>

      {/* ================= HISTÓRIA ================= */}
      <section className="wrap mt-24 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div>
          <p className="eyebrow">Os detalhes</p>
          <p className="mt-6 font-mono text-[clamp(18px,2.2vw,28px)] leading-relaxed">
            FROM: DRY LAKE<br />19°58’22.2”S 43°56’34.4”W<br />TO: ALL OVER THE WORLD<br />WGS84 // 360° GLOBAL <span className="mark">(letz bora)</span>
          </p>
          <p className="mt-8 text-lg text-ink-2 max-w-lg">Na barra das duas peças, as coordenadas de onde a BORA sai, em BH, e para onde vai: o mundo todo. Nas costas, o que a gente acredita: correr é jeito de viver, e vai além do pace.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden bg-sand"><Image src={shirt.images[3]?.url ?? shirt.images[0].url} alt="Coordenadas na barra da camiseta" fill sizes="25vw" className="object-cover" /></div>
          <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden mt-10 bg-sand"><Image src={cropped.images[4]?.url ?? cropped.images[0].url} alt="Coordenadas na barra da regata" fill sizes="25vw" className="object-cover" /></div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="wrap mt-24 max-w-3xl">
        <p className="eyebrow">Perguntas frequentes</p>
        <h2 className="display text-[clamp(32px,4.4vw,56px)] mt-3">Antes de garantir</h2>
        <div className="mt-8 border-t border-line divide-y divide-line">
          {faq.map((f) => (
            <details key={f.q} className="group py-6">
              <summary className="flex items-center justify-between gap-6 cursor-pointer list-none text-lg font-bold">{f.q}<PlusIcon className="shrink-0 transition-transform group-open:rotate-45" /></summary>
              <p className="mt-3 text-ink-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="wrap mt-24">
        <div className="relative overflow-hidden rounded-[36px] bg-neon p-8 sm:p-14 grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <Image src="/img/marca/pattern-bora-black.webp" alt="" width={1000} height={1100} className="absolute -right-40 -top-40 w-[700px] opacity-[0.08] pointer-events-none" />
          <div className="relative">
            <p className="font-black uppercase tracking-widest text-sm">Pré-venda · {edition}</p>
            <p className="display text-[clamp(44px,7vw,110px)] mt-3">{finalTitle}</p>
          </div>
          <div className="relative flex flex-wrap gap-3">
            <a href="#pecas" className="btn btn-primary btn-lg">{cta}</a>
            <p className="w-full text-sm">A partir de {brl(Math.min(shirt.priceCents, cropped.priceCents))}{pixBadge(rules) ? ` · ${pixBadge(rules)}` : ""} · retirada no evento</p>
          </div>
        </div>
        <p className="mt-6 text-xs text-ink-3 max-w-2xl">{disclaimer}</p>
      </section>
    </>
  );
}
