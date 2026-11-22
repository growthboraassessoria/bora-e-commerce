import { NextResponse } from "next/server";
import { z } from "zod";
import { addNewsletter } from "@/lib/server/orders";
import { lockedResponse } from "@/lib/server/settings";

export async function POST(req: Request) {
  const locked = await lockedResponse();
  if (locked) return locked;
  const parsed = z.object({ email: z.email().max(160) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  await addNewsletter(parsed.data.email.toLowerCase());
  return NextResponse.json({ ok: true });
}
