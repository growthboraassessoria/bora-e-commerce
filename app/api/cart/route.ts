import { NextResponse } from "next/server";
import { z } from "zod";
import { quote } from "@/lib/server/quote";
import { lockedResponse } from "@/lib/server/settings";

const Body = z.object({
  lines: z.array(z.object({ variantId: z.string().max(80), quantity: z.number().int().min(1).max(10) })).max(30),
  coupon: z.string().max(40).optional(),
  cep: z.string().max(12).optional(),
  shippingId: z.string().max(20).optional(),
  method: z.enum(["pix", "card"]).optional(),
  exclude: z.array(z.string().max(40)).max(5).optional(),
});

export async function POST(req: Request) {
  const locked = await lockedResponse();
  if (locked) return locked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Carrinho inválido" }, { status: 400 });
  return NextResponse.json(await quote(parsed.data));
}
