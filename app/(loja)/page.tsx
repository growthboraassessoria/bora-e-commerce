import { SALES_OPEN } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";
import Hero3D from "@/components/home/Hero3D";
import ProductCard from "@/components/ui/ProductCard";
import Price from "@/components/ui/Price";
import { ArrowIcon, PixIcon, ReturnIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
import { getCategories, getProduct, queryProducts } from "@/lib/server/catalog";
import { STORE } from "@/lib/config";
import { brl } from "@/lib/money";
import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { organizationLd, pageMeta, websiteLd } from "@/lib/seo";
import { getPaymentRules } from "@/lib/server/settings";
import { paymentSentence, pixBadge } from "@/lib/payment-rules";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Vista o movimento",
    description: "BORA Store: pré-venda Volta 18K · Edição Pampulha. Camiseta LETZ BORA de algodão e regata cropped, retirada no evento na Pampulha. Pix ou cartão pela Pagar.me.",
    path: "/",
  }),
  title: { absolute: "BORA Store · Vista o movimento" },
};

export default async function Home() {
  const rules = await getPaymentRules();
  const pixText = pixBadge(rules);
  const [categories, featured, shirt, cropped] = await Promise.all([
    getCategories(),
    queryProducts({ sort: "destaques" }),
    getProduct("camiseta-letz-bora-algodao"),
    getProduct("regata-cropped-bora"),
  ]);

  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      {/* HERO 3D */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_70%_40%,#ffffff_0%,#f5f5f1_55%,#ebebe6_100%)]">
        <Image src="/img/marca/pattern-bora-black.webp" alt="" width={1200} height={1340} className="absolute -left-48 -bottom-64 w-[900px] opacity-[0.035] pointer-events-none select-none" priority />
        <div className="wrap relative grid lg:grid-cols-[1.05fr_1fr] items-center min-h-[calc(100svh-100px)] py-10 lg:py-0">
          <div className="relative z-10 order-2 lg:order-1 animate-rise">
            <p className="eyebrow flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-neon ring-2 ring-ink/10" /> {SALES_OPEN ? "Pré-venda aberta" : "Pré-venda em breve"} · Volta 18K · Edição Pampulha</p>
            <h1 className="display mt-5 text-[clamp(52px,8vw,128px)]">
              Vista o<br /><span className="mark">movimento.</span>
            </h1>
            <p className="mt-6 max-w-[480px] text-lg sm:text-xl text-ink-2 leading-relaxed">
              Roupa feita por quem corre junto. Running is a lifestyle, beyond the pace. Do primeiro 5k ao pós-treino.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/volta-18k" className="btn btn-primary btn-lg">Pré-venda Volta 18K <ArrowIcon size={18} /></Link>
              <Link href="/experiencia" className="btn btn-ghost btn-lg">Entrar na experiência 3D</Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              <li className="flex items-center gap-2"><TruckIcon size={18} /> Retirada no evento, na Pampulha</li>
              {pixText ? <li className="flex items-center gap-2"><PixIcon size={18} /> {pixText}</li> : null}
            </ul>
          </div>
          <div className="relative order-1 lg:order-2 h-[46svh] min-h-[340px] lg:h-[calc(100svh-100px)] -mx-[var(--gutter)] lg:mx-0">
            <Hero3D />
            <Image src="/img/marca/sticker-letz-bora-green.webp" alt="" width={260} height={180} className="absolute right-[6%] top-[10%] w-[110px] sm:w-[150px] rotate-[10deg] drop-shadow-xl pointer-events-none" />
            {shirt ? (
              <Link href={`/produto/${shirt.slug}`} className="absolute left-[4%] bottom-[8%] lg:bottom-[14%] flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur-md p-2 pr-5 shadow-[var(--shadow-float)] hover:-translate-y-0.5 transition-transform">
                <span className="relative size-14 rounded-xl overflow-hidden bg-sand"><Image src={shirt.images[0].url} alt="" fill sizes="56px" className="object-cover" /></span>
                <span>
                  <span className="block text-[11px] font-bold uppercase tracking-widest text-ink-3">Pré-venda</span>
                  <span className="block font-bold leading-tight">{shirt.name}</span>
                  <span className="block text-sm">{brl(shirt.priceCents)}</span>
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* PRÉ-VENDA VOLTA 18K */}
      {shirt && cropped ? (
        <section className="wrap mt-20">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Pré-venda · Volta 18K · Edição Pampulha</p>
              <h2 className="display text-[clamp(36px,5.4vw,80px)] mt-2">200 peças.<br /><span className="mark">Garanta a sua.</span></h2>
            </div>
            <Link href="/volta-18k" className="hidden sm:inline-flex btn btn-primary">Entrar na pré-venda</Link>
          </div>
          <div className="mt-10 grid lg:grid-cols-2 gap-4">
            {[
              { p: shirt, img: shirt.images[0], kicker: "Algodão", line: "Running is a lifestyle." },
              { p: cropped, img: cropped.images[2] ?? cropped.images[0], kicker: "Performance", line: "Beyond the pace." },
            ].map(({ p, img, kicker, line }) => (
              <Link key={p.slug} href="/volta-18k#pecas" className="group relative block aspect-[4/5] lg:aspect-[5/6] overflow-hidden rounded-[32px] bg-sand">
                <Image src={img.url} alt={img.alt} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-[1.04]" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <div className="flex items-end justify-between gap-4 rounded-[22px] bg-white/85 backdrop-blur-xl p-5 shadow-[var(--shadow-float)]">
                    <div className="min-w-0">
                      <p className="eyebrow">{kicker} · {line}</p>
                      <p className="mt-1.5 text-2xl font-black uppercase tracking-tight leading-none">{p.name}</p>
                      <p className="mt-2 font-bold">{brl(p.priceCents)}</p>
                    </div>
                    <span className="size-12 shrink-0 rounded-full bg-neon grid place-items-center transition-transform group-hover:translate-x-1"><ArrowIcon size={20} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[shirt.images[2], shirt.images[3], cropped.images[3], cropped.images[5]].filter(Boolean).map((im) => (
              <div key={im!.url} className="relative aspect-square overflow-hidden rounded-[24px] bg-sand">
                <Image src={im!.url} alt={im!.alt} fill sizes="(min-width:640px) 25vw, 50vw" className="object-cover" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* CATEGORIAS */}
      <section className="wrap mt-20">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Categorias</p>
            <h2 className="display text-[clamp(36px,5vw,64px)] mt-2">Escolha a largada</h2>
          </div>
          <Link href="/colecao/todos" className="hidden sm:inline-flex btn btn-ghost">Ver tudo</Link>
        </div>
        <div className="mt-8 flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-[var(--gutter)] px-[var(--gutter)] pb-2">
          {categories.map((c) => (
            <Link key={c.slug} href={`/colecao/${c.slug}`} className="group relative shrink-0 snap-start w-[72%] sm:w-[40%] lg:w-[calc((100%-64px)/5)] aspect-[3/4] rounded-[24px] overflow-hidden bg-sand">
              <Image src={c.image} alt={c.name} fill sizes="(min-width:1024px) 20vw, 70vw" className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105" />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-black/0" />
              <div className="absolute left-5 right-5 bottom-5 text-white flex items-end justify-between">
                <p className="text-2xl font-black uppercase tracking-tight">{c.name}</p>
                <span className="size-10 rounded-full bg-neon text-black grid place-items-center transition-transform group-hover:translate-x-1"><ArrowIcon size={18} /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* DESTAQUES */}
      <section className="wrap mt-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow">À venda</p>
            <h2 className="display text-[clamp(36px,5vw,64px)] mt-2">A coleção</h2>
          </div>
          <Link href="/colecao/todos" className="text-sm font-bold underline underline-offset-4">Ver todos</Link>
        </div>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
          {featured.slice(0, 8).map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
        </div>
      </section>

      {/* EXPERIÊNCIA */}
      <section className="wrap mt-28">
        <Link href="/experiencia" className="group relative block overflow-hidden rounded-[32px] bg-ink text-white min-h-[460px]">
          <Image src="/img/marca/pattern-pista.webp" alt="" fill sizes="100vw" className="object-cover opacity-90 transition-transform duration-[1.6s] ease-out-expo group-hover:scale-105" />
          <div className="absolute inset-0 bg-linear-to-r from-black via-black/80 to-black/10" />
          <div className="relative p-8 sm:p-14 max-w-xl">
            <p className="eyebrow text-neon">Experiência 3D</p>
            <h2 className="display text-[clamp(40px,6vw,88px)] mt-4">Corra<br />pela loja.</h2>
            <p className="mt-5 text-white/75 text-lg">Uma pista em 3D com as peças da Volta 18K. Role a página e vá até a chegada.</p>
            <span className="btn btn-neon btn-lg mt-8">Largar agora <ArrowIcon size={18} /></span>
          </div>
        </Link>
      </section>

      {/* MANIFESTO */}
      <section className="mt-28 relative overflow-hidden">
        <div className="relative h-[70svh] min-h-[460px]">
          <Image src="/img/marca/bora-comunidade-1600.webp" alt="Comunidade BORA reunida" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 wrap flex flex-col justify-end pb-14 text-white">
            <p className="display text-[clamp(40px,7.4vw,120px)]">Bora pra cima.<br />Bora todo dia.<br /><span className="text-neon">Bora sem atalho.</span></p>
          </div>
        </div>
      </section>

      {/* GARANTIAS */}
      <section className="wrap mt-20 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <TruckIcon size={22} />, t: "Retirada no evento", d: "Av. Otacílio Negrão de Lima, 2827 · das 4h às 11h." },
          { icon: <PixIcon size={22} />, t: pixText || "Cartão de crédito", d: rules.cardEnabled && rules.maxInstallments > 1 ? `${pixText ? "Ou em" : "Em"} até ${rules.maxInstallments}x sem juros no cartão.` : paymentSentence(rules) + "." },
          { icon: <ReturnIcon size={22} />, t: "Troca na hora", d: "Tamanho não serviu? Troque na retirada." },
          { icon: <ShieldIcon size={22} />, t: "Compra segura", d: "Pagamento processado pela Pagar.me." },
        ].map((b) => (
          <div key={b.t} className="card p-6">
            <div className="size-11 rounded-full bg-neon grid place-items-center">{b.icon}</div>
            <p className="mt-4 font-bold text-lg">{b.t}</p>
            <p className="mt-1 text-ink-2 text-sm">{b.d}</p>
          </div>
        ))}
      </section>
    </>
  );
}

// Catálogo e estoque vêm do banco: a página é refeita a cada 60 s.
export const revalidate = 60;
