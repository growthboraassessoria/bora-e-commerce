// Carrinho abandonado: o navegador avisa quando a sacola muda e a cada etapa do checkout.
// Só grava no checkout do próprio token (segredo guardado no localStorage) e nunca devolve dados gravados.
import { z } from "zod";
import { SALES_OPEN } from "@/lib/config";
import { isValidCpf } from "@/lib/cpf";
import { onlyDigits } from "@/lib/shipping";
import { quote } from "@/lib/server/quote";
import { markRecovered, saveCheckout, TOKEN_RE } from "@/lib/server/checkouts";
import { lockedResponse } from "@/lib/server/settings";
import { clientIp, hit } from "@/lib/server/rate-limit";

const str = (max: number) => z.string().trim().max(max);

const Body = z.object({
  token: z.string().regex(TOKEN_RE),
  recovered: z.boolean().optional(),
  step: z.enum(["cart", "contact", "pickup", "payment"]).default("cart"),
  lines: z.array(z.object({ variantId: z.string().max(80), quantity: z.number().int().min(1).max(10) })).max(30).default([]),
  coupon: str(40).optional(),
  method: z.enum(["pix", "card"]).optional(),
  visitorId: str(80).optional(),
  utm: z.record(z.string().max(40), z.string().max(200)).optional(),
  contact: z.object({ name: str(120).optional(), email: str(160).optional(), phone: str(20).optional(), cpf: str(20).optional() }).optional(),
});

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "ref"];

export async function POST(req: Request) {
  if (!SALES_OPEN) return new Response(null, { status: 204 });
  const locked = await lockedResponse();
  if (locked) return locked;
  if (!hit(`checkout:${await clientIp()}`, 240, 10 * 60_000)) return Response.json({ error: "Muitas requisições" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const d = parsed.data;

  try {
    if (d.recovered) {
      await markRecovered(d.token);
      return Response.json({ ok: true });
    }
    // Preço, nome e foto vêm do catálogo do servidor, nunca do navegador.
    const q = await quote({ lines: d.lines, coupon: d.coupon, method: d.method });
    const c = d.contact ?? {};
    const email = c.email && z.email().safeParse(c.email).success ? c.email.toLowerCase() : undefined;
    const phone = c.phone ? onlyDigits(c.phone) : "";
    const res = await saveCheckout(d.token, {
      step: d.step,
      lines: q.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, name: l.name, variantLabel: l.variantLabel, unitCents: l.unitCents, image: l.image })),
      itemCount: q.lines.reduce((s, l) => s + l.quantity, 0),
      subtotalCents: q.totals.subtotalCents,
      totalCents: q.totals.totalCents,
      couponCode: q.discount?.code ?? null,
      visitorId: d.visitorId || null,
      utm: Object.fromEntries(Object.entries(d.utm ?? {}).filter(([k, v]) => UTM_KEYS.includes(k) && v)),
      paymentMethod: d.step === "payment" ? d.method ?? null : null,
      contact: {
        name: c.name || undefined,
        email,
        phone: phone.length >= 10 && phone.length <= 11 ? phone : undefined,
        cpf: c.cpf && isValidCpf(c.cpf) ? onlyDigits(c.cpf) : undefined,
      },
    });
    return Response.json(res);
  } catch (e) {
    console.error("checkout-session", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
