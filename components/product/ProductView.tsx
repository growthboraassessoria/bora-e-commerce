"use client";
import SizePicker from "./SizePicker";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { cart } from "@/lib/cart";
import { brl } from "@/lib/money";
import { SALES_OPEN } from "@/lib/config";
import { usePaymentRules } from "@/components/store/PaymentRulesProvider";
import { installmentsFor, pixBadge, pixPct } from "@/lib/payment-rules";
import SoonCTA from "@/components/ui/SoonCTA";
import type { Product } from "@/lib/types";
import { isColorOption, isSizeOption, optionsLabel, productOptions, variantOptions } from "@/lib/options";
import { CheckIcon, MinusIcon, PlusIcon, ReturnIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
import PaymentIcons from "@/components/ui/PaymentIcons";
import { PICKUP, pickupWhen } from "@/lib/presale";
import SizeGuide from "./SizeGuide";
import { useIsPhone, useSheetDrag } from "@/components/ui/ios";

// Opções no padrão da Shopify: Cor em bolinhas, Tamanho no seletor grande e as demais (Estilo, Material...) em botões.
// A variante é a combinação escolhida; preço, estoque e foto vêm dela.
export default function ProductView({ p }: { p: Product }) {
  const router = useRouter();
  const opts = useMemo(() => productOptions(p), [p]);
  const vopts = useMemo(() => new Map(p.variants.map((v) => [v.id, variantOptions(v, opts)])), [p, opts]);
  const colorOpt = opts.find((o) => isColorOption(o.name));
  const sizeOpt = opts.find((o) => isSizeOption(o.name));
  const otherOpts = opts.filter((o) => o !== colorOpt && o !== sizeOpt);
  const fits = (vid: string, s: Record<string, string>, skip?: string) => Object.entries(s).every(([k, val]) => k === skip || vopts.get(vid)?.[k] === val);

  // Começa na primeira cor/estilo com peça; o tamanho fica para o cliente escolher (a não ser que só exista um).
  const [sel, setSel] = useState<Record<string, string>>(() => {
    const first = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
    const fo = first ? variantOptions(first, opts) : {};
    const out: Record<string, string> = {};
    for (const o of opts) if (o !== sizeOpt || o.values.length === 1) out[o.name] = fo[o.name] ?? o.values[0]?.value ?? "";
    return out;
  });
  const color = colorOpt ? sel[colorOpt.name] ?? "" : "";
  const colors = useMemo(() => (colorOpt?.values ?? []).map((c) => [c.value, c.hex || p.variants.find((v) => v.color === c.value)?.colorHex || "#000000"] as const), [colorOpt, p]);
  const sizeName = sizeOpt?.name ?? "";
  const sizes = useMemo(() => (sizeOpt?.values ?? []).map((sv) => {
    const v = p.variants.find((x) => vopts.get(x.id)?.[sizeName] === sv.value && fits(x.id, sel, sizeName));
    return { id: v?.id ?? `sem:${sv.value}`, size: sv.value, stock: v?.stock ?? 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p, sizeOpt, sizeName, sel, vopts]);
  const single = !sizeOpt || sizeOpt.values.length <= 1;
  const variant = opts.every((o) => sel[o.name]) ? p.variants.find((v) => opts.every((o) => vopts.get(v.id)?.[o.name] === sel[o.name])) ?? null : null;
  const label = variant ? optionsLabel(vopts.get(variant.id) ?? {}, opts) : "";
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [needSize, setNeedSize] = useState(false);
  const [guide, setGuide] = useState(false);
  // Celular: escolher o tamanho numa folha que sobe de baixo (em vez de rolar a página até o seletor).
  const phone = useIsPhone();
  const [sizeSheet, setSizeSheet] = useState<null | "add" | "buy">(null);
  const sheetDrag = useSheetDrag(() => setSizeSheet(null));

  useEffect(() => {
    track("view_item", {
      item_id: p.id, item_name: p.name, price: p.priceCents / 100, value: p.priceCents / 100, currency: "BRL",
      items: [{ item_id: p.id, item_name: p.name, item_category: p.categorySlug, price: p.priceCents / 100, quantity: 1 }],
    });
  }, [p.id, p.name, p.priceCents, p.categorySlug]);

  const images = useMemo(() => {
    const ownVariant = variant?.image ? p.images.filter((i) => i.url === variant.image) : [];
    const own = p.images.filter((i) => i.color === color && !ownVariant.includes(i));
    const neutral = p.images.filter((i) => !i.color && !ownVariant.includes(i));
    const others = p.images.filter((i) => i.color && i.color !== color && !ownVariant.includes(i));
    const extra = variant?.image && !ownVariant.length ? [{ url: variant.image, alt: p.name }] : [];
    return [...extra, ...ownVariant, ...own, ...neutral, ...others];
  }, [p, color, variant]);
  const [active, setActive] = useState(0);
  // Carrossel do celular (rolagem com "snap", foto a foto): o ponto ativo acompanha o dedo.
  const reel = useRef<HTMLDivElement>(null);
  const goTo = (i: number) => { setActive(i); const r = reel.current; if (r) r.scrollTo({ left: i * r.clientWidth, behavior: "smooth" }); };
  useEffect(() => { reel.current?.scrollTo({ left: 0 }); }, [color]);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const price = variant?.priceCents ?? p.priceCents;
  const compareAt = variant?.compareAtCents ?? p.compareAtCents;
  const rules = usePaymentRules();
  const inst = rules.cardEnabled ? installmentsFor(price, rules) : { n: 1, each: price };
  const pix = Math.round(price * (1 - pixPct(rules) / 100));
  // Esgotado na escolha atual (sem contar o tamanho, que o cliente ainda vai escolher).
  const soldOut = p.variants.filter((v) => fits(v.id, sel, sizeName)).every((v) => v.stock <= 0);
  const maxQty = Math.min(10, variant?.stock ?? 10);

  const pick = (name: string, value: string) => {
    const next = { ...sel, [name]: value };
    // Troca de cor/estilo mantém o tamanho se ele ainda tiver peça; senão o cliente escolhe de novo.
    if (sizeOpt && name !== sizeName && sizeOpt.values.length > 1 && next[sizeName]) {
      const keep = p.variants.find((v) => fits(v.id, next) && v.stock > 0);
      if (!keep) delete next[sizeName];
    }
    setSel(next);
    if (colorOpt && name === colorOpt.name) setActive(0);
  };
  const valueOut = (name: string, value: string) => !p.variants.some((v) => vopts.get(v.id)?.[name] === value && fits(v.id, sel, name) && v.stock > 0);

  const add = (goCheckout = false) => {
    if (!variant) {
      if (single || sel[sizeName]) return; // combinação que não existe: nada a adicionar
      setNeedSize(true);
      if (phone) setSizeSheet(goCheckout ? "buy" : "add");
      else document.getElementById("tamanhos")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSizeSheet(null);
    cart.add(variant.id, qty, !goCheckout, { itemId: p.id, name: p.name, size: label || variant.size, priceCents: variant.priceCents ?? p.priceCents });
    if (goCheckout) router.push("/checkout");
    else {
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1.25fr_1fr] gap-8 lg:gap-14">
      {/* Galeria */}
      <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+16px)] self-start">
        {/* Celular e tablet: fotos de ponta a ponta, deslizando uma a uma */}
        <div className="lg:hidden relative -mx-[var(--gutter)] sm:mx-0 sm:rounded-[28px] overflow-hidden bg-sand">
          <div ref={reel} onScroll={(e) => { const r = e.currentTarget; const i = Math.round(r.scrollLeft / Math.max(1, r.clientWidth)); if (i !== active) setActive(i); }}
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain" aria-label="Fotos do produto">
            {images.map((img, i) => (
              <div key={img.url} className="relative shrink-0 w-full aspect-[4/5] snap-center snap-always">
                <Image src={img.url} alt={img.alt} fill priority={i === 0} sizes="(min-width:640px) 90vw, 100vw" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="absolute left-4 top-4 flex gap-1.5 pointer-events-none">
            {p.badges.map((b, i) => <span key={b} className={`chip ${i === 0 ? "chip-neon" : "chip-ink"}`}>{b}</span>)}
          </div>
          {images.length > 1 ? (
            <div className="absolute bottom-3 inset-x-0 flex justify-center">
              <div className="flex items-center gap-0.5 rounded-full bg-white/70 backdrop-blur-md px-1.5">
                {images.map((_, i) => (
                  <button key={i} type="button" aria-label={`Foto ${i + 1} de ${images.length}`} aria-current={i === active} onClick={() => goTo(i)} className="h-7 px-[3px] grid place-items-center">
                    <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-5 bg-ink" : "w-1.5 bg-ink/30"}`} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="hidden lg:block relative aspect-[4/5] rounded-[28px] overflow-hidden bg-sand cursor-zoom-in"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
        >
          {images.map((img, i) => (
            <Image
              key={img.url}
              src={img.url}
              alt={img.alt}
              fill
              priority={i === 0}
              sizes="(min-width:1024px) 55vw, 100vw"
              className={`object-cover transition-[opacity,transform] duration-500 ${i === active ? "opacity-100" : "opacity-0"}`}
              style={i === active && zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            />
          ))}
          <div className="absolute left-4 top-4 flex gap-1.5">
            {p.badges.map((b, i) => <span key={b} className={`chip ${i === 0 ? "chip-neon" : "chip-ink"}`}>{b}</span>)}
          </div>
        </div>
        <div className="hidden lg:flex mt-3 gap-3 overflow-x-auto no-scrollbar">
          {images.map((img, i) => (
            <button key={img.url} type="button" onClick={() => setActive(i)} aria-label={img.alt} className={`relative shrink-0 size-20 rounded-2xl overflow-hidden bg-sand transition ${i === active ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"}`}>
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Compra */}
      <div className="min-w-0">
        <p className="eyebrow">{p.subtitle}</p>
        <h1 className="display text-[clamp(34px,4.4vw,64px)] mt-2 lg:mt-3">{p.name}</h1>
        <div className="mt-5 flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-black tracking-tight">{brl(price)}</span>
          {compareAt && compareAt > price ? <span className="text-lg text-ink-3 line-through">{brl(compareAt)}</span> : null}
        </div>
        <p className="mt-1 text-ink-2">
          {inst.n > 1 ? <>ou {inst.n}x de {brl(inst.each)} sem juros{rules.pixEnabled ? " · " : null}</> : null}
          {rules.pixEnabled ? <strong className="text-ink">{pix < price ? `${brl(pix)} no Pix` : "Pix com aprovação na hora"}</strong> : null}
        </p>

        {colors.length > 1 ? (
          <div className="mt-8">
            <p className="text-sm font-bold">{colorOpt?.name ?? "Cor"}: <span className="font-normal text-ink-2">{color}</span></p>
            <div className="mt-3 flex gap-2.5">
              {colors.map(([name, hex]) => (
                <button key={name} type="button" onClick={() => colorOpt && pick(colorOpt.name, name)} aria-label={name} aria-pressed={name === color} className={`size-11 rounded-full p-1 transition ${name === color ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink/40"}`}>
                  <span className="block size-full rounded-full ring-1 ring-black/10" style={{ background: hex }} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {otherOpts.filter((o) => o.values.length > 1).map((o) => (
          <div key={o.name} className="mt-7">
            <p className="text-sm font-bold">{o.name}: <span className="font-normal text-ink-2">{sel[o.name] ?? ""}</span></p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={o.name}>
              {o.values.map((ov) => {
                const on = sel[o.name] === ov.value;
                const out = valueOut(o.name, ov.value);
                return (
                  <button key={ov.value} type="button" role="radio" aria-checked={on} onClick={() => pick(o.name, ov.value)}
                    aria-label={`${ov.value}${out ? ", esgotado" : ""}`}
                    className={`h-11 min-w-12 px-4 rounded-full text-sm font-bold transition ${on ? "bg-ink text-white" : "ring-1 ring-line hover:ring-ink"} ${out ? "text-ink-3 line-through decoration-2" : ""} ${on && out ? "!text-white/70" : ""}`}>
                    {ov.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {!single ? (
          <div className="mt-7" id="tamanhos">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-bold ${needSize && !variant ? "text-danger" : ""}`}>{needSize && !variant ? "Escolha um tamanho" : <>{sizeName || "Tamanho"}{sel[sizeName] ? <span className="font-normal text-ink-2">: {sel[sizeName]}</span> : null}</>}</p>
              <button type="button" onClick={() => setGuide(true)} className="h-11 -my-2.5 text-sm font-bold underline underline-offset-4">Guia de medidas</button>
            </div>
            <div className="mt-3">
              <SizePicker item={{ id: p.id, name: p.name }} sizes={sizes} value={sizes.find((x) => x.size === sel[sizeName])?.id ?? null} low={3} invalid={needSize} onPick={(id) => { const s2 = sizes.find((x) => x.id === id); if (s2) pick(sizeName, s2.size); setNeedSize(false); setQty(1); }} />
            </div>
            {variant && variant.stock > 0 && variant.stock <= 3 ? <p className="mt-2 text-sm font-bold">⚡ Só {variant.stock} {variant.stock === 1 ? "peça" : "peças"} nesse tamanho</p> : null}
          </div>
        ) : null}

        {!SALES_OPEN ? (
          <div className="mt-8">
            <SoonCTA className="w-full" message={`Oi! Quero garantir a ${p.name}${variant ? ` (${label})` : ""} na pré-venda Volta 18K. Me avisa quando abrir?`} />
            <p className="mt-3 text-sm text-ink-2">A compra online abre junto com a pré-venda. Escolha o tamanho e chame a gente: avisamos você primeiro.</p>
          </div>
        ) : (<>
        <div className="mt-8 flex gap-3">
          <div className="inline-flex items-center rounded-full ring-1 ring-line h-[60px] shrink-0">
            <button type="button" aria-label="Diminuir" className="w-10 sm:w-12 h-full grid place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))}><MinusIcon size={18} /></button>
            <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
            <button type="button" aria-label="Aumentar" className="w-10 sm:w-12 h-full grid place-items-center" onClick={() => setQty((q) => Math.min(maxQty, q + 1))}><PlusIcon size={18} /></button>
          </div>
          <button type="button" disabled={soldOut || (!!variant && variant.stock <= 0)} onClick={() => add(false)} className="btn btn-primary btn-lg flex-1 min-w-0 !px-5">
            {soldOut ? (otherOpts.some((o) => o.values.length > 1) ? "Esgotado nesta combinação" : colors.length > 1 ? "Esgotado nesta cor" : "Esgotado") : variant && variant.stock <= 0 ? "Esgotado" : added ? (<><CheckIcon size={18} /> Na sacola</>) : "Adicionar à sacola"}
          </button>
        </div>
        <button type="button" disabled={soldOut || (!!variant && variant.stock <= 0)} onClick={() => add(true)} className="btn btn-neon btn-lg btn-block mt-3">Comprar agora</button>
        </>)}

        <ul className="mt-8 grid grid-cols-3 gap-2 sm:gap-3 text-[13px] sm:text-sm leading-tight">
          <li className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-2.5 rounded-2xl bg-sand p-3 sm:p-3.5"><TruckIcon size={20} /> Retirada no evento</li>
          <li className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-2.5 rounded-2xl bg-sand p-3 sm:p-3.5"><ReturnIcon size={20} /> Troca na retirada</li>
          <li className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-2.5 rounded-2xl bg-sand p-3 sm:p-3.5"><ShieldIcon size={20} /> Compra segura</li>
        </ul>

        <div className="mt-6"><PaymentIcons /></div>
        <div className="mt-6 rounded-2xl ring-1 ring-line p-4 text-sm">
          <p className="font-bold">Sem envio pelo correio: você retira no evento</p>
          <p className="mt-1 text-ink-2">{PICKUP.address} · {PICKUP.city}<br />{pickupWhen()}</p>
        </div>

        <div className="mt-10">
          <p className="text-[17px] sm:text-lg leading-relaxed text-ink-2 whitespace-pre-line">{p.description}</p>
          <ul className="mt-6 grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-3 gap-y-2.5">
            {p.highlights.map((h) => <li key={h} className="flex items-center gap-2 text-sm font-bold"><span className="size-5 rounded-full bg-neon grid place-items-center"><CheckIcon size={12} /></span>{h}</li>)}
          </ul>
        </div>

        <div className="mt-8 border-t border-line divide-y divide-line">
          <details className="group py-5" open>
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold [&>svg]:shrink-0">Detalhes <span className="size-6 shrink-0 grid place-items-center"><PlusIcon size={18} className="transition-transform group-open:rotate-45" /></span></summary>
            <dl className="mt-4 grid gap-2 text-sm">
              {p.details.map((d) => <div key={d.label} className="flex justify-between gap-6"><dt className="text-ink-3">{d.label}</dt><dd className="text-right">{d.value}</dd></div>)}
            </dl>
          </details>
          <details className="group py-5">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold [&>svg]:shrink-0">Cuidados <span className="size-6 shrink-0 grid place-items-center"><PlusIcon size={18} className="transition-transform group-open:rotate-45" /></span></summary>
            <p className="mt-4 text-sm text-ink-2 leading-relaxed">{p.care}</p>
          </details>
          <details className="group py-5">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold [&>svg]:shrink-0">Retirada e trocas <span className="size-6 shrink-0 grid place-items-center"><PlusIcon size={18} className="transition-transform group-open:rotate-45" /></span></summary>
            <p className="mt-4 text-sm text-ink-2 leading-relaxed">Não fazemos envio: a peça é entregue no evento, em {PICKUP.address}, {pickupWhen().toLowerCase()}. Leve documento com foto e o número do pedido. Se o tamanho não servir, troque na hora, se houver na grade. Você também pode desistir em até 7 dias depois da retirada. Veja a <a className="underline" href="/politicas/trocas-e-devolucoes">política de trocas</a> e a <a className="underline" href="/politicas/entrega">retirada</a>.</p>
          </details>
        </div>
      </div>

      {/* Barra fixa no celular (no lugar da barra de abas, como numa tela "empurrada" do iOS) */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/85 backdrop-blur-xl backdrop-saturate-150 shadow-[0_-0.5px_0_var(--color-line-strong)] px-[max(16px,env(safe-area-inset-left))] pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-3 truncate">{variant ? label : !single && !sel[sizeName] ? "Escolha o tamanho" : "Escolha as opções"}</p>
          <p className="text-lg font-black leading-tight">{brl(price)}</p>
        </div>
        {SALES_OPEN ? (
          <button type="button" disabled={soldOut} onClick={() => add(false)} className="btn btn-primary h-12 px-7 shrink-0">{added ? "Na sacola ✓" : "Adicionar"}</button>
        ) : (
          <SoonCTA className="flex-1 !min-h-[52px] !text-sm" label="Abre em breve" message={`Oi! Quero garantir a ${p.name}${variant ? ` (${label})` : ""} na pré-venda Volta 18K. Me avisa quando abrir?`} />
        )}
      </div>

      {/* Folha de tamanhos (celular) */}
      {sizeSheet ? (
        <div className="lg:hidden fixed inset-0 z-[75]" role="dialog" aria-label="Escolha o tamanho">
          <div className="absolute inset-0 bg-black/35 animate-[fade-in_.25s_ease-out]" onClick={() => setSizeSheet(null)} />
          <div style={sheetDrag.style} className={`absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] animate-sheet ${sheetDrag.dragging ? "" : "transition-transform duration-300"}`}>
            <div className="pt-2.5 pb-1 touch-none" {...sheetDrag.handlers}>
              <span className="sheet-grabber" />
              <div className="mt-3 flex items-center gap-3">
                <div className="relative size-14 shrink-0 rounded-xl overflow-hidden bg-sand"><Image src={images[0]?.url ?? p.images[0].url} alt="" fill sizes="56px" className="object-cover" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink-3 truncate">{p.name}</p>
                  <p className="text-xl font-black uppercase tracking-tight leading-tight">Escolha o tamanho</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <SizePicker item={{ id: p.id, name: p.name }} sizes={sizes} value={sizes.find((x) => x.size === sel[sizeName])?.id ?? null} low={3} onPick={(id) => { const s2 = sizes.find((x) => x.id === id); if (s2) pick(sizeName, s2.size); setNeedSize(false); setQty(1); }} />
            </div>
            <button type="button" onClick={() => setGuide(true)} className="mt-2 h-11 text-sm font-bold underline underline-offset-4">Guia de medidas</button>
            <button type="button" disabled={!variant || variant.stock <= 0} onClick={() => add(sizeSheet === "buy")} className={`btn btn-lg btn-block mt-2 ${sizeSheet === "buy" ? "btn-neon" : "btn-primary"}`}>
              {!variant ? "Escolha um tamanho" : sizeSheet === "buy" ? `Comprar agora · ${brl(price)}` : `Adicionar à sacola · ${brl(price)}`}
            </button>
          </div>
        </div>
      ) : null}

      {guide ? <SizeGuide category={p.categorySlug} onClose={() => setGuide(false)} /> : null}
    </div>
  );
}
