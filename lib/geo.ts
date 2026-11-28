// Localização da compra (loja.orders.geo). Serve para o BORA OS mostrar no mapa de onde vêm os pedidos.
// Até três registros por pedido, cada um com a fonte e a data:
//  - ip: cidade aproximada pela rede (cabeçalhos da Vercel). Sempre que houver. Nos pedidos antigos, "ip-analytics" (vem do analytics).
//  - cep: CEP de cobrança do cartão (CEP, bairro, cidade e UF; nunca rua nem número). Coordenadas da BrasilAPI, se houver.
//  - gps: posição do celular, só quando o cliente toca em "Compartilhar minha localização".
// Cópia do tipo em BORA OS/lib/loja/geo.ts. Mudou aqui, muda lá.

export type GeoSource = "ip" | "ip-analytics" | "cep" | "gps";

export type GeoPoint = {
  source: GeoSource;
  /** Quando foi registrado (ISO). */
  at: string;
  country?: string | null;
  uf?: string | null;
  city?: string | null;
  district?: string | null;
  /** Só no registro "cep": 8 dígitos. */
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Precisão em metros (GPS). */
  accuracy?: number | null;
};

export type OrderGeo = { ip?: GeoPoint | null; cep?: GeoPoint | null; gps?: GeoPoint | null };

/** O que o checkout manda (o servidor valida tudo de novo). */
export type GpsInput = { lat: number; lng: number; accuracy: number; at?: number };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Latitude e longitude plausíveis (e não 0,0, que é o "sem posição" de muitos aparelhos). */
export function validLatLng(lat: unknown, lng: unknown): lat is number {
  return isNum(lat) && isNum(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

/** Arredonda para ~1 m (6 casas). Mais que isso é ruído. */
export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Texto limpo e curto (cidade, bairro), sem caracteres de controle. */
export function cleanText(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
}
