// Coletor do analytics próprio: recebe o lote do navegador (sendBeacon), limpa e grava.
// Supabase: loja.events. Modo local: .data/events.jsonl (na Vercel sem banco, /tmp/bora-store/events.jsonl).
// Sempre responde 204 rápido; a gravação acontece depois da resposta (after).
import { after, userAgent, type NextRequest } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db, storeMode } from "@/lib/server/db";
import { isBotUA, scrubProps, scrubText } from "@/lib/server/analytics-privacy";
import { hit } from "@/lib/server/rate-limit";

const MAX_BODY = 64 * 1024;
const id = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const txt = (n: number) => z.string().max(n * 4).transform((s) => scrubText(s, n));
const opt = (n: number) => txt(n).optional().nullable();

const Batch = z.object({
  v: id,
  s: id,
  sn: z.number().int().min(1).max(100000).optional(),
  u: z.object({ source: opt(100), medium: opt(100), campaign: opt(100), content: opt(100), term: opt(100) }).partial().optional(),
  c: z.object({ device: opt(20), browser: opt(30), os: opt(30), screen: opt(20), vp: opt(20), dpr: z.number().optional(), lang: opt(20), tz: opt(40) }).partial().optional(),
  e: z.array(z.object({
    n: z.string().regex(/^[a-z0-9_]{1,40}$/),
    t: z.number().optional(),
    p: txt(300),
    ti: opt(200),
    r: opt(300),
    pr: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(50),
});

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const geo = (req: NextRequest, h: string) => {
  const v = req.headers.get(h);
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 80); } catch { return v.slice(0, 80); }
};

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  const agent = userAgent(req);
  if (isBotUA(ua) || agent.isBot) return noContent();

  // Só aceita lotes vindos da própria loja.
  const origin = req.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== req.headers.get("host")) return noContent(); } catch { return noContent(); }
  }
  // Até 120 lotes por minuto por IP (um visitante normal manda poucos).
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim().slice(0, 64);
  if (!hit(`t:${ip}`, 120, 60_000)) return noContent();
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return new Response(null, { status: 413 });
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY) return new Response(null, { status: raw ? 413 : 400 });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  const parsed = Batch.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  const b = parsed.data;

  const now = Date.now();
  const device = agent.device.type === "mobile" || agent.device.type === "tablet" ? agent.device.type : agent.device.type ? "other" : (b.c?.device ?? "desktop");
  const browser = agent.browser.name ?? b.c?.browser ?? null;
  const os = agent.os.name ?? b.c?.os ?? null;
  const country = geo(req, "x-vercel-ip-country");
  const region = geo(req, "x-vercel-ip-country-region");
  const city = geo(req, "x-vercel-ip-city");

  const rows = b.e.map((e) => {
    let props = (scrubProps(e.pr ?? {}) ?? {}) as Record<string, unknown>;
    if (JSON.stringify(props).length > 4000) props = { truncated: true };
    if (e.n === "page_view" || e.n === "session_start") {
      props = { ...props, screen: b.c?.screen ?? null, viewport: b.c?.vp ?? null, lang: b.c?.lang ?? null, tz: b.c?.tz ?? null, session_number: b.sn ?? null };
    }
    // Hora do navegador, se for plausível (até 1 dia de diferença); senão, a do servidor.
    const at = e.t && Math.abs(e.t - now) < 86_400_000 ? new Date(e.t) : new Date(now);
    return {
      at: at.toISOString(),
      name: e.n,
      visitor_id: b.v,
      session_id: b.s,
      path: e.p.split("?")[0] || "/",
      title: e.ti ?? null,
      referrer: e.r ?? null,
      utm_source: b.u?.source ?? null,
      utm_medium: b.u?.medium ?? null,
      utm_campaign: b.u?.campaign ?? null,
      utm_content: b.u?.content ?? null,
      utm_term: b.u?.term ?? null,
      device,
      browser,
      os,
      country,
      region,
      city,
      props,
    };
  });

  after(async () => {
    try {
      if (storeMode() === "supabase") {
        const { error } = await db().from("events").insert(rows);
        if (error) console.error("[analytics] falha ao gravar:", error.message);
      } else {
        const dir = process.env.VERCEL ? "/tmp/bora-store" : path.join(process.cwd(), ".data");
        await mkdir(dir, { recursive: true });
        await appendFile(path.join(dir, "events.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
      }
    } catch (err) {
      console.error("[analytics] falha ao gravar:", err instanceof Error ? err.message : err);
    }
  });
  return noContent();
}
