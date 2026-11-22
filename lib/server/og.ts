import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_URL } from "../config";

// Peças das imagens de compartilhamento (app/opengraph-image.tsx e a do produto): fontes da marca, logo e fotos.
export const OG_SIZE = { width: 1200, height: 630 };

const heavy = readFile(join(process.cwd(), "app/fonts/Altone-Heavy.ttf"));
const bold = readFile(join(process.cwd(), "app/fonts/Altone-Bold.ttf"));
const logo = readFile(join(process.cwd(), "public/img/marca/logo-black.png"), "base64").then((b) => `data:image/png;base64,${b}`);

export async function ogFonts() {
  const [h, b] = await Promise.all([heavy, bold]);
  return [
    { name: "Altone", data: h, weight: 900 as const, style: "normal" as const },
    { name: "Altone", data: b, weight: 700 as const, style: "normal" as const },
  ];
}

export const ogLogo = () => logo;

/**
 * Foto do produto em JPEG (o gerador de imagem não lê WebP). Lê do disco e, se não achar
 * (na Vercel a pasta public fica no CDN), baixa pelo endereço do site. Sem foto, devolve null.
 */
export async function ogPhoto(url: string, height = 630): Promise<string | null> {
  try {
    let buf: Buffer | null = null;
    if (!/^https?:\/\//.test(url)) buf = await readFile(join(process.cwd(), "public", url.replace(/^\/+/, ""))).catch(() => null);
    if (!buf) {
      const res = await fetch(/^https?:\/\//.test(url) ? url : `${SITE_URL}${url}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    }
    const sharp = (await import("sharp")).default;
    const jpg = await sharp(buf).resize({ height, width: Math.round(height * 0.9), fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}
