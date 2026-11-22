// Gera as imagens da loja a partir do kit de identidade (ID-VISUAL-BORA-2026) e dos assets já tratados na LP.
// Uso: npm run assets  (roda da pasta da loja)
import sharp from "sharp";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "../..");
const KIT = path.join(ROOT, "ID-VISUAL-BORA-2026");
const LP = path.join(ROOT, "projetos/lp-vamos-em-frente/public/brand");
const OUT = path.resolve("public/img");
mkdirSync(path.join(OUT, "produtos"), { recursive: true });
mkdirSync(path.join(OUT, "marca"), { recursive: true });

const src = {
  drifit: path.join(KIT, "APLICAÇÕES ID NOVA/EXPORT/DRI FIT.jpg"),
  cortaVentoModelo: path.join(KIT, "APLICAÇÕES ID NOVA/EXPORT/CORTA-VENTO.jpg.png"),
  cortaVento: path.join(KIT, "APLICAÇÕES ID NOVA/Windbreaker Mockup.png"),
  bone: path.join(KIT, "APLICAÇÕES ID NOVA/EXPORT/FIVE PANEL.jpg"),
  macaquinho: path.join(KIT, "APLICAÇÕES ID NOVA/EXPORT/MACAQUINHO.png"),
  meia: path.join(KIT, "APLICAÇÕES ID NOVA/EXPORT/MEIA.jpg.png"),
};

// Coleção 01 (renders enviados pelo Alex em 19/11/2026, originais em assets-src/colecao-01)
const C1 = path.resolve("assets-src/colecao-01");
const c1 = {
  camFrente: path.join(C1, "Camiseta preta Bora com coordenadas.png"),
  camCostas: path.join(C1, "Camiseta preta com estampa circular vibrante.png"),
  // Cropped preta (renders novos de 19/11/2026). Os renders da cropped neon ficam na pasta, mas não são mais usados.
  cropFrente: path.join(C1, "NovoCropped2-Front.png"),
  cropCostas: path.join(C1, "NovoCropped3-Front.png"),
};

// Recortes em pixels da imagem original: [left, top, width, height]
const jobs = [
  // Camisetas Dri-Fit: a imagem tem preta (esquerda) e neon (direita), frente e costas
  ["camiseta-preta-par", src.drifit, [0, 0, 960, 1080]],
  ["camiseta-neon-par", src.drifit, [960, 0, 960, 1080]],
  ["camiseta-preta-frente", src.drifit, [150, 140, 560, 800]],
  ["camiseta-preta-costas", src.drifit, [500, 140, 460, 800]],
  ["camiseta-neon-frente", src.drifit, [1010, 140, 560, 800]],
  ["camiseta-neon-costas", src.drifit, [1380, 140, 500, 800]],
  ["camiseta-duo", src.drifit, null],
  // Corta-vento
  ["corta-vento-frente", src.cortaVento, null],
  ["corta-vento-modelo", src.cortaVentoModelo, [960, 0, 960, 1080]],
  ["corta-vento-produto", src.cortaVentoModelo, [0, 0, 960, 1080]],
  // Boné
  ["bone-five-panel", src.bone, null],
  ["bone-five-panel-detalhe", src.bone, [1700, 900, 2400, 1900]],
  // Macaquinho
  ["macaquinho-branco", src.macaquinho, [0, 0, 960, 1080]],
  ["macaquinho-preto", src.macaquinho, [960, 0, 960, 1080]],
  ["macaquinho-duo", src.macaquinho, null],
  // Meias
  ["meia-neon", src.meia, [0, 0, 640, 1080]],
  ["meia-preta", src.meia, [640, 0, 640, 1080]],
  ["meia-branca", src.meia, [1280, 0, 640, 1080]],
  ["meia-trio", src.meia, null],
  // Coleção 01 · Camiseta algodão preta (1122 × 1402)
  ["c1-camiseta-frente", c1.camFrente, null],
  ["c1-camiseta-costas", c1.camCostas, null],
  ["c1-camiseta-selo", c1.camCostas, [300, 210, 540, 540]],
  ["c1-camiseta-coordenadas", c1.camFrente, [190, 875, 420, 525]],
  // Coleção 01 · Regata cropped preta (1122 × 1402)
  ["c1-cropped-preta-frente", c1.cropFrente, null],
  ["c1-cropped-preta-costas", c1.cropCostas, null],
  ["c1-cropped-preta-simbolo", c1.cropCostas, [280, 245, 560, 700]],
  ["c1-cropped-preta-coordenadas", c1.cropFrente, [120, 945, 364, 455]],
  ["c1-cropped-preta-logo", c1.cropFrente, [330, 308, 460, 575]],
];

for (const [name, file, crop] of jobs) {
  let img = sharp(file).flatten({ background: "#ffffff" });
  if (crop) {
    const [left, top, width, height] = crop;
    img = img.extract({ left, top, width, height });
  }
  const buf = await img.toBuffer();
  for (const w of [1600, 800]) {
    await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(OUT, "produtos", `${name}-${w}.webp`));
  }
  console.log("ok", name);
}

// Cropped frente e costas lado a lado (vitrine da coleção e imagem de compartilhamento)
{
  const [a, b] = await Promise.all([c1.cropFrente, c1.cropCostas].map((f) => sharp(f).flatten({ background: "#ffffff" }).toBuffer()));
  const duo = await sharp({ create: { width: 2244, height: 1402, channels: 3, background: "#ffffff" } })
    .composite([{ input: a, left: 0, top: 0 }, { input: b, left: 1122, top: 0 }]).png().toBuffer();
  for (const w of [1600, 800]) {
    await sharp(duo).resize({ width: w }).webp({ quality: 82 }).toFile(path.join(OUT, "produtos", `c1-cropped-preta-duo-${w}.webp`));
  }
  console.log("ok", "c1-cropped-preta-duo");
}

// Marca: reaproveita o que a LP já tratou
const copy = [
  "logo-black.png", "logo-white.png", "simbolo-black.png", "simbolo-white.png",
  "bora-comunidade-1600.webp", "bora-comunidade-1024.webp", "bora-house-1280.webp", "bora-house-640.webp",
  "pattern-bora-black.webp", "pattern-bora-green.webp", "pattern-bora-white.webp", "pattern-pista.webp", "pattern-pista-2.webp",
  "sticker-letz-bora-green.webp", "sticker-chegada-green.webp", "sticker-medalha-green.webp", "sticker-fist-bump-green.webp", "sticker-hand-green.webp", "sticker-localizacao-green.webp",
  "bora-contornos.svg",
];
for (const f of copy) {
  const from = path.join(LP, f);
  if (existsSync(from)) copyFileSync(from, path.join(OUT, "marca", f));
  else console.warn("faltou", f);
}

// Fonte Altone (mesma da LP)
mkdirSync(path.resolve("app/fonts"), { recursive: true });
for (const f of ["Altone-Regular.ttf", "Altone-Medium.ttf", "Altone-Bold.ttf", "Altone-Heavy.ttf"]) {
  const from = path.join(ROOT, "projetos/lp-vamos-em-frente/app/fonts", f);
  if (existsSync(from)) copyFileSync(from, path.resolve("app/fonts", f));
}
console.log("assets prontos");
