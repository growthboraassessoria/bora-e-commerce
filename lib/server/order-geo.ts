import "server-only";
// Monta e grava a localização da compra (ver lib/geo.ts). Nada aqui pode derrubar uma compra: erro vira log.
import { db, storeMode } from "./db";
import { withLocalDb } from "./local-store";
import { cleanText, round6, validLatLng, type GeoPoint, type GpsInput, type OrderGeo } from "../geo";

type HeaderBag = { get(name: string): string | null };

// A Vercel manda a cidade com URL-encoding ("S%C3%A3o%20Paulo").
function header(h: HeaderBag, name: string, max = 80) {
  const v = h.get(name);
  if (!v) return null;
  let t = v;
  try { t = decodeURIComponent(v); } catch { /* fica como veio */ }
  return cleanText(t, max);
}

/** Cidade aproximada pela rede, dos cabeçalhos x-vercel-ip-* (fora da Vercel, nada). */
export function ipGeo(h: HeaderBag, now = new Date()): GeoPoint | null {
  const country = header(h, "x-vercel-ip-country", 4);
  const uf = header(h, "x-vercel-ip-country-region", 8);
  const city = header(h, "x-vercel-ip-city");
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lng = Number(h.get("x-vercel-ip-longitude"));
  const hasLL = h.get("x-vercel-ip-latitude") != null && validLatLng(lat, lng);
  if (!country && !uf && !city && !hasLL) return null;
  return {
    source: "ip", at: now.toISOString(), country: country?.toUpperCase() ?? null, uf: uf?.toUpperCase() ?? null, city,
    lat: hasLL ? round6(lat) : null, lng: hasLL ? round6(lng) : null,
  };
}

/** CEP de cobrança: só CEP, bairro, cidade e UF. */
export function cepGeo(b: { zip?: string | null; district?: string | null; city?: string | null; uf?: string | null } | null | undefined, now = new Date()): GeoPoint | null {
  const zip = (b?.zip ?? "").replace(/\D/g, "");
  if (zip.length !== 8) return null;
  const uf = cleanText(b?.uf, 2)?.toUpperCase() ?? null;
  return {
    source: "cep", at: now.toISOString(), country: "BR", zip,
    uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : null, city: cleanText(b?.city, 64), district: cleanText(b?.district, 80),
  };
}

/** GPS do celular. Precisão acima de 50 km não diz nada: descarta. */
export function gpsGeo(g: GpsInput | null | undefined, now = new Date()): GeoPoint | null {
  if (!g || !validLatLng(g.lat, g.lng)) return null;
  const acc = Number(g.accuracy);
  if (!Number.isFinite(acc) || acc < 0 || acc > 50_000) return null;
  // Hora da leitura, se for plausível (até 1 hora antes); senão, a do servidor.
  const at = g.at && Number.isFinite(g.at) && g.at <= now.getTime() + 60_000 && now.getTime() - g.at < 3_600_000 ? new Date(g.at) : now;
  return { source: "gps", at: at.toISOString(), lat: round6(g.lat), lng: round6(g.lng), accuracy: Math.round(acc) };
}

export function buildGeo(parts: OrderGeo): OrderGeo | null {
  const out: OrderGeo = {};
  if (parts.ip) out.ip = parts.ip;
  if (parts.cep) out.cep = parts.cep;
  if (parts.gps) out.gps = parts.gps;
  return Object.keys(out).length ? out : null;
}

/** Coordenadas do CEP pela BrasilAPI v2 (nem todo CEP tem). Também completa bairro/cidade/UF que faltarem. */
export async function lookupCep(zip: string): Promise<{ lat: number | null; lng: number | null; district?: string; city?: string; uf?: string } | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${zip}`, { signal: AbortSignal.timeout(4000), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const d = (await res.json()) as { state?: string; city?: string; neighborhood?: string; location?: { coordinates?: { latitude?: string | number; longitude?: string | number } } };
    const lat = Number(d.location?.coordinates?.latitude);
    const lng = Number(d.location?.coordinates?.longitude);
    const extra = { district: d.neighborhood || undefined, city: d.city || undefined, uf: d.state || undefined };
    return validLatLng(lat, lng) ? { lat: round6(lat), lng: round6(lng), ...extra } : { lat: null, lng: null, ...extra };
  } catch {
    return null;
  }
}

/** Depois da compra: busca as coordenadas do CEP e grava no registro "cep" do pedido. */
export async function enrichCepGeo(orderId: string, zip: string) {
  try {
    const r = await lookupCep(zip);
    if (!r) return;
    const patch = (g: OrderGeo | null | undefined): OrderGeo | null => {
      if (!g?.cep || g.cep.zip !== zip) return null;
      const cep: GeoPoint = {
        ...g.cep,
        district: g.cep.district ?? cleanText(r.district, 80), city: g.cep.city ?? cleanText(r.city, 64),
        uf: g.cep.uf ?? (cleanText(r.uf, 2)?.toUpperCase() ?? null),
        ...(r.lat != null ? { lat: r.lat, lng: r.lng } : {}),
      };
      return { ...g, cep };
    };
    if (storeMode() === "local") {
      await withLocalDb((d) => {
        const o = d.orders.find((x) => x.id === orderId);
        const next = patch(o?.geo);
        if (o && next) o.geo = next;
      });
      return;
    }
    const { data } = await db().from("orders").select("geo").eq("id", orderId).maybeSingle();
    const next = patch((data?.geo as OrderGeo | null) ?? null);
    if (!next) return;
    const { error } = await db().from("orders").update({ geo: next }).eq("id", orderId);
    if (error) throw error;
  } catch (e) {
    // Sem a migration 0008 (coluna geo) ou BrasilAPI fora do ar: o pedido segue sem as coordenadas do CEP.
    console.error("enrichCepGeo", (e as Error).message);
  }
}
