"use client";
import SizePicker from "./SizePicker";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { cart } from "@/lib/cart";
import { brl } from "@/lib/money";
import { SALES_OPEN } from "@/lib/config";
import { usePaymentRules } from "@/components/store/PaymentRulesProvider";
import { installmentsFor, pixBadge, pixPct } from "@/lib/payment-rules";
import SoonCTA from "@/components/ui/SoonCTA";
import type { Product } from "@/lib/types";
import { CheckIcon, MinusIcon, PlusIcon, ReturnIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
import PaymentIcons from "@/components/ui/PaymentIcons";
import { PICKUP, pickupWhen } from "@/lib/presale";
import SizeGuide from "./SizeGuide";

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XGG", "34-38", "39-43", "U"];

export default function ProductView({ p }: { p: Product }) {
  const router = useRouter();
  const colors = useMemo(() => [...new Map(p.variants.map((v) => [v.color, v.colorHex])).entries()], [p]);
  const [color, setColor] = useState(colors[0]?.[0] ?? "");
  const sizes = useMemo(
    () => p.variants.filter((v) => v.color === color).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)),
    [p, color],
  );
  const single = sizes.length === 1;
  const [variantId, setVariantId] = useState<string | null>(single ? sizes[0].id : null);
  const variant = p.variants.find((v) => v.id === variantId) ?? null;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [needSize, setNeedSize] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    track("view_item", {
      item_id: p.id, item_name: p.name, price: p.priceCents / 100, value: p.priceCents / 100, currency: "BRL",
      items: [{ item_id: p.id, item_name: p.name, item_category: p.categorySlug, price: p.priceCents / 100, quantity: 1 }],
    });
  }, [p.id, p.name, p.priceCents, p.categorySlug]);

  const images = useMemo(() => {
    const own = p.images.filter((i) => i.color === color);
    const neutral = p.images.filter((i) => !i.color);
    const others = p.images.filter((i) => i.color && i.color !== color);
    return [...own, ...neutral, ...others];
  }, [p, color]);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const price = variant?.priceCents ?? p.priceCents;
  const rules = usePaymentRules();
  const inst = rules.cardEnabled ? installmentsFor(price, rules) : { n: 1, each: price };
  const pix = Math.round(price * (1 - pixPct(rules) / 100));
  const soldOut = sizes.every((v) => v.stock <= 0);
  const maxQty = Math.min(10, variant?.stock ?? 10);

  const pickColor = (c: string) => {
    setColor(c);
    setActive(0);
    const next = p.variants.filter((v) => v.color === c);
    const same = next.find((v) => v.size === variant?.size && v.stock > 0);
    setVariantId(next.length === 1 ? next[0].id : same?.id ?? null);
  };

  const add = (goCheckout = false) => {
    if (!variant) {
      setNeedSize(true);
      document.getElementById("tamanhos")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    cart.add(variant.id, qty, !goCheckout, { itemId: p.id, name: p.name, size: variant.size, priceCents: variant.priceCents ?? p.priceCents });
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
        <div
          className="relative aspect-[4/5] rounded-[28px] overflow-hidden bg-sand cursor-zoom-in"
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
          <div className="lg:hidden absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
            {images.map((_, i) => <button key={i} type="button" aria-label={`Foto ${i + 1}`} onClick={() => setActive(i)} className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-ink" : "w-1.5 bg-ink/30"}`} />)}
          </div>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar">
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
        <h1 className="display text-[clamp(36px,4.4vw,64px)] mt-3">{p.name}</h1>
        <div className="mt-5 flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-black tracking-tight">{brl(price)}</span>
          {p.compareAtCents ? <span className="text-lg text-ink-3 line-through">{brl(p.compareAtCents)}</span> : null}
        </div>
        <p className="mt-1 text-ink-2">
          {inst.n > 1 ? <>ou {inst.n}x de {brl(inst.each)} sem juros{rules.pixEnabled ? " · " : null}</> : null}
          {rules.pixEnabled ? <strong className="text-ink">{pix < price ? `${brl(pix)} no Pix` : "Pix com aprovação na hora"}</strong> : null}
        </p>

        {colors.length > 1 ? (
          <div className="mt-8">
            <p className="text-sm font-bold">Cor: <span className="font-normal text-ink-2">{color}</span></p>
            <div className="mt-3 flex gap-2.5">
              {colors.map(([name, hex]) => (
                <button key={name} type="button" onClick={() => pickColor(name)} aria-label={name} aria-pressed={name === color} className={`size-11 rounded-full p-1 transition ${name === color ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink/40"}`}>
                  <span className="block size-full rounded-full ring-1 ring-black/10" style={{ background: hex }} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!single ? (
          <div className="mt-7" id="tamanhos">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-bold ${needSize && !variant ? "text-danger" : ""}`}>{needSize && !variant ? "Escolha um tamanho" : <>Tamanho{variant ? <span className="font-normal text-ink-2">: {variant.size}</span> : null}</>}</p>
              <button type="button" onClick={() => setGuide(true)} className="text-sm font-bold underline underline-offset-4">Guia de medidas</button>
            </div>
            <div className="mt-3">
              <SizePicker item={{ id: p.id, name: p.name }} sizes={sizes.map((v) => ({ id: v.id, size: v.size, stock: v.stock }))} value={variantId} low={3} invalid={needSize} onPick={(id) => { setVariantId(id); setNeedSize(false); setQty(1); }} />
            </div>
            {variant && variant.stock <= 3 ? <p className="mt-2 text-sm font-bold">⚡ Só {variant.stock} {variant.stock === 1 ? "peça" : "peças"} nesse tamanho</p> : null}
          </div>
        ) : null}

        {!SALES_OPEN ? (
          <div className="mt-8">
            <SoonCTA className="w-full" message={`Oi! Quero garantir a ${p.name}${variant ? ` tamanho ${variant.size}` : ""} na pré-venda Volta 18K. Me avisa quando abrir?`} />
            <p className="mt-3 text-sm text-ink-2">A compra online abre junto com a pré-venda. Escolha o tamanho e chame a gente: avisamos você primeiro.</p>
          </div>
        ) : (<>
        <div className="mt-8 flex gap-3">
          <div className="inline-flex items-center rounded-full ring-1 ring-line h-[60px] shrink-0">
            <button type="button" aria-label="Diminuir" className="w-10 sm:w-12 h-full grid place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))}><MinusIcon size={18} /></button>
            <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
            <button type="button" aria-label="Aumentar" className="w-10 sm:w-12 h-full grid place-items-center" onClick={() => setQty((q) => Math.min(maxQty, q + 1))}><PlusIcon size={18} /></button>
          </div>
          <button type="button" disabled={soldOut} onClick={() => add(false)} className="btn btn-primary btn-lg flex-1 min-w-0 !px-5">
            {soldOut ? "Esgotado nesta cor" : added ? (<><CheckIcon size={18} /> Na sacola</>) : "Adicionar à sacola"}
          </button>
        </div>
        <button type="button" disabled={soldOut} onClick={() => add(true)} className="btn btn-neon btn-lg btn-block mt-3">Comprar agora</button>
        </>)}

        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <li className="flex items-center gap-2.5 rounded-2xl bg-sand p-3.5"><TruckIcon size={20} /> Retirada no evento</li>
          <li className="flex items-center gap-2.5 rounded-2xl bg-sand p-3.5"><ReturnIcon size={20} /> Troca na retirada</li>
          <li className="flex items-center gap-2.5 rounded-2xl bg-sand p-3.5"><ShieldIcon size={20} /> Compra segura</li>
        </ul>

        <div className="mt-6"><PaymentIcons /></div>
        <div className="mt-6 rounded-2xl ring-1 ring-line p-4 text-sm">
          <p className="font-bold">Sem envio pelo correio: você retira no evento</p>
          <p className="mt-1 text-ink-2">{PICKUP.address} · {PICKUP.city}<br />{pickupWhen()}</p>
        </div>

        <div className="mt-10">
          <p className="text-lg leading-relaxed text-ink-2">{p.description}</p>
          <ul className="mt-6 grid grid-cols-2 gap-2">
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

      {/* Barra fixa no celular */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-xl border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3 truncate">{variant ? `${variant.color} · ${variant.size === "U" ? "Único" : variant.size}` : "Escolha o tamanho"}</p>
          <p className="font-black">{brl(price)}</p>
        </div>
        {SALES_OPEN ? (
          <button type="button" disabled={soldOut} onClick={() => add(false)} className="btn btn-primary flex-1">{added ? "Na sacola ✓" : "Adicionar"}</button>
        ) : (
          <SoonCTA className="flex-1 !min-h-[52px] !text-sm" label="Abre em breve" message={`Oi! Quero garantir a ${p.name}${variant ? ` tamanho ${variant.size}` : ""} na pré-venda Volta 18K. Me avisa quando abrir?`} />
        )}
      </div>

      {guide ? <SizeGuide category={p.categorySlug} onClose={() => setGuide(false)} /> : null}
    </div>
  );
}
