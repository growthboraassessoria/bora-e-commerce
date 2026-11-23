// Catálogo inicial da loja. É a mesma informação de supabase/seed.sql (gerado por scripts/gen-seed-sql.mjs).
// PREÇOS E ESTOQUES SÃO PROVISÓRIOS: definir com a BORA antes de publicar.
import type { Category, Coupon, Product, Variant } from "./types";

const img = (name: string) => `/img/produtos/${name}-1600.webp`;

export const CATEGORIES: Category[] = [
  { id: "volta-18k", slug: "volta-18k", name: "Volta 18K", description: "Pré-venda Edição Pampulha. Duas peças, 200 unidades: camiseta de algodão e regata cropped. From: Dry Lake, to: all over the world.", image: img("c1-cropped-preta-duo"), position: 0 },
  { id: "camisetas", slug: "camisetas", name: "Camisetas", description: "Dri-fit leve, seca rápido e veste o movimento. Do treino de terça à prova de domingo.", image: img("camiseta-duo"), position: 1 },
  { id: "agasalhos", slug: "agasalhos", name: "Agasalhos", description: "Corta-vento para o treino das 5h e para a volta pra casa depois da prova.", image: img("corta-vento-frente"), position: 2 },
  { id: "regatas", slug: "regatas", name: "Regatas", description: "Regata cropped de tecido performance, leve e de secagem rápida. Para o treino e para depois dele.", image: img("c1-cropped-preta-frente"), position: 3 },
  { id: "triathlon", slug: "triathlon", name: "Triathlon", description: "Macaquinho de prova para nadar, pedalar e correr sem trocar de roupa.", image: img("macaquinho-duo"), position: 3 },
  { id: "acessorios", slug: "acessorios", name: "Acessórios", description: "Boné five panel e meias de compressão leve. Detalhe que se vê de longe.", image: img("bone-five-panel"), position: 4 },
  { id: "kits", slug: "kits", name: "Kits", description: "Combinações prontas com preço de kit. O jeito mais rápido de vestir BORA.", image: img("camiseta-neon-par"), position: 5 },
  // Coleção dos extras (gel etc.). Fica fora da vitrine: o extra aparece como oferta na sacola e no checkout (lib/extras.ts).
  { id: "nutricao", slug: "nutricao", name: "Nutrição", description: "Energia e hidratação para o treino e para a prova.", image: img("carbs-gel-pack"), position: 6 },
];

const SHIRT_SIZES = ["PP", "P", "M", "G", "GG", "XGG"];
const BODY_SIZES = ["P", "M", "G", "GG"];

function variants(prefix: string, colors: { name: string; hex: string; code: string }[], sizes: string[], stock: number | ((c: string, s: string) => number)): Variant[] {
  const out: Variant[] = [];
  for (const c of colors) {
    for (const s of sizes) {
      const id = `${prefix}-${c.code}-${s}`.toLowerCase();
      out.push({ id, sku: id.toUpperCase(), color: c.name, colorHex: c.hex, size: s, priceCents: null, stock: typeof stock === "function" ? stock(c.code, s) : stock });
    }
  }
  return out;
}

const PRETO = { name: "Preto", hex: "#0a0a0a", code: "pto" };
const NEON = { name: "Verde Neon", hex: "#ceff00", code: "neo" };
const BRANCO = { name: "Branco", hex: "#ffffff", code: "bco" };

const ALL_PRODUCTS: Product[] = [
  // ---------- Pré-venda VOLTA 18K · Edição Pampulha (renders de 19/11/2026, grade informada pelo Alex) ----------
  {
    id: "camiseta-letz-bora-algodao",
    slug: "camiseta-letz-bora-algodao",
    name: "Camiseta LETZ BORA",
    subtitle: "Volta 18K · Algodão",
    description:
      "Camiseta preta de algodão para o dia a dia de quem corre. Na frente, o BORA pequeno. Nas costas, o selo LETZ BORA: running is a lifestyle, beyond the pace. Na barra, as coordenadas de onde a gente sai, em BH, e para onde vai: FROM: DRY LAKE, TO: ALL OVER THE WORLD.",
    categorySlug: "camisetas",
    priceCents: 10000,
    compareAtCents: null,
    badges: ["Pré-venda", "Volta 18K"],
    tags: ["lifestyle", "volta-18k", "pre-venda", "algodao"],
    featured: true,
    highlights: ["Algodão macio", "Selo LETZ BORA nas costas", "Coordenadas na barra", "Para treinar e para depois"],
    details: [
      { label: "Tecido", value: "Algodão" },
      { label: "Modelagem", value: "Regular, unissex" },
      { label: "Estampa frente", value: "BORA, em branco" },
      { label: "Estampa costas", value: "Selo LETZ BORA em branco e verde neon" },
    ],
    care: "Lavar do avesso em água fria. Não usar alvejante. Secar à sombra. Não passar ferro sobre as estampas.",
    images: [
      { url: img("c1-camiseta-costas"), alt: "Camiseta LETZ BORA preta, costas com o selo Running is a lifestyle, Beyond the pace" },
      { url: img("c1-camiseta-frente"), alt: "Camiseta LETZ BORA preta, frente com BORA" },
      { url: img("c1-camiseta-selo"), alt: "Detalhe do selo LETZ BORA nas costas" },
      { url: img("c1-camiseta-coordenadas"), alt: "Detalhe das coordenadas na barra: From Dry Lake, To all over the world" },
    ],
    variants: variants("c1cam", [PRETO], ["PP", "P", "M", "G", "GG"], (_c, s) => ({ PP: 15, P: 20, M: 40, G: 20, GG: 5 })[s] ?? 0), // 100 peças
    position: -2,
  },
  {
    id: "regata-cropped-bora",
    slug: "regata-cropped-bora",
    name: "Regata Cropped BORA",
    subtitle: "Volta 18K · Performance",
    description:
      "Regata cropped preta em tecido performance, leve e de secagem rápida. BORA em verde neon no peito, coordenadas da Pampulha na barra e, nas costas, as curvas de nível da marca em volta do raio. Para o treino e para o pós-treino.",
    categorySlug: "regatas",
    priceCents: 12000,
    compareAtCents: null,
    badges: ["Pré-venda", "Volta 18K"],
    tags: ["corrida", "volta-18k", "pre-venda", "feminino", "cropped"],
    featured: true,
    highlights: ["Tecido performance", "Secagem rápida", "Curvas de nível nas costas", "Estampa verde neon"],
    details: [
      { label: "Tecido", value: "Performance fabric, quick dry" },
      { label: "Modelagem", value: "Cropped, justa" },
      { label: "Cor", value: "Preta com estampa verde neon" },
      { label: "Estampa frente", value: "BORA no peito e coordenadas na barra" },
      { label: "Estampa costas", value: "Curvas de nível com o raio BORA" },
    ],
    care: "Lavar à mão ou na máquina em água fria. Não usar amaciante (tira o efeito de secagem rápida). Secar à sombra.",
    images: [
      { url: img("c1-cropped-preta-frente"), alt: "Regata Cropped BORA preta, frente com BORA em verde neon" },
      { url: img("c1-cropped-preta-costas"), alt: "Regata Cropped BORA preta, costas com as curvas de nível e o raio" },
      { url: img("c1-cropped-preta-duo"), alt: "Regata Cropped BORA preta, frente e costas" },
      { url: img("c1-cropped-preta-simbolo"), alt: "Detalhe das curvas de nível com o raio nas costas" },
      { url: img("c1-cropped-preta-coordenadas"), alt: "Detalhe das coordenadas na barra: From Dry Lake, To all over the world" },
      { url: img("c1-cropped-preta-logo"), alt: "Detalhe do BORA em verde neon no peito" },
    ],
    variants: variants("c1crop", [PRETO], ["PP", "P", "M", "G"], (_c, s) => ({ PP: 20, P: 45, M: 30, G: 5 })[s] ?? 0), // 100 peças
    position: -1,
  },
  {
    id: "camiseta-dri-fit-bora",
    slug: "camiseta-dri-fit-bora",
    name: "Camiseta Dri-Fit BORA",
    subtitle: "A camiseta oficial do movimento",
    description:
      "Tecido dri-fit leve que tira o suor da pele e seca rápido. Na frente, o BORA discreto. Nas costas, o grito: letz BORAAA!! Corte reto, gola careca e as curvas de nível da marca subindo pela barra.",
    categorySlug: "camisetas",
    priceCents: 14900,
    compareAtCents: null,
    badges: ["Lançamento"],
    tags: ["corrida", "essenciais", "drop-2026"],
    featured: true,
    highlights: ["Seca rápido", "Leve e respirável", "letz BORAAA!! nas costas", "Etiqueta sem costura"],
    details: [
      { label: "Tecido", value: "Poliéster dri-fit com toque macio" },
      { label: "Modelagem", value: "Regular, unissex" },
      { label: "Estampa", value: "Silk de alta durabilidade" },
      { label: "Origem", value: "Feita no Brasil" },
    ],
    care: "Lavar à mão ou na máquina em água fria, do avesso. Não usar alvejante nem amaciante. Secar à sombra. Não passar ferro na estampa.",
    images: [
      { url: img("camiseta-preta-par"), alt: "Camiseta Dri-Fit BORA preta, frente e costas", color: "Preto" },
      { url: img("camiseta-preta-frente"), alt: "Camiseta Dri-Fit BORA preta, frente", color: "Preto" },
      { url: img("camiseta-neon-par"), alt: "Camiseta Dri-Fit BORA verde neon, frente e costas", color: "Verde Neon" },
      { url: img("camiseta-neon-frente"), alt: "Camiseta Dri-Fit BORA verde neon, frente", color: "Verde Neon" },
      { url: img("camiseta-duo"), alt: "Camisetas Dri-Fit BORA preta e verde neon" },
    ],
    variants: variants("drifit", [PRETO, NEON], SHIRT_SIZES, (_c, s) => (s === "XGG" ? 6 : s === "PP" ? 8 : 24)),
    position: 1,
  },
  {
    id: "corta-vento-bora",
    slug: "corta-vento-bora",
    name: "Corta-vento BORA",
    subtitle: "Para o treino das 5h",
    description:
      "Corta-vento leve com capuz, recortes em preto, branco e verde neon e o escudo bordado no peito. Bloqueia o vento, aguenta garoa fina e dobra pequeno para ir na mochila. Na manga, o BORAAA!! que todo mundo reconhece na largada.",
    categorySlug: "agasalhos",
    priceCents: 38900,
    compareAtCents: null,
    badges: ["Lançamento"],
    tags: ["corrida", "drop-2026"],
    featured: true,
    highlights: ["Bloqueia o vento", "Repele garoa fina", "Capuz com regulagem", "Punhos e barra com elástico"],
    details: [
      { label: "Tecido", value: "Tactel leve com acabamento repelente" },
      { label: "Fechamento", value: "Zíper frontal completo" },
      { label: "Bolsos", value: "Dois bolsos laterais" },
      { label: "Modelagem", value: "Regular, unissex" },
    ],
    care: "Lavar à mão em água fria. Não torcer. Secar à sombra, pendurado. Não usar secadora.",
    images: [
      { url: img("corta-vento-frente"), alt: "Corta-vento BORA, frente" },
      { url: img("corta-vento-modelo"), alt: "Corta-vento BORA vestido" },
      { url: img("corta-vento-produto"), alt: "Corta-vento BORA, detalhe dos recortes" },
    ],
    variants: variants("cortavento", [{ name: "Preto e Branco", hex: "#0a0a0a", code: "pb" }], BODY_SIZES.concat("XGG"), (_c, s) => (s === "XGG" ? 3 : 12)),
    position: 2,
  },
  {
    id: "macaquinho-tri-bora",
    slug: "macaquinho-tri-bora",
    name: "Macaquinho Tri BORA",
    subtitle: "Nada, pedala e corre",
    description:
      "Macaquinho de triathlon com manga curta, zíper nas costas e forro de secagem rápida. As curvas de nível da marca na frente e as três faixas neon na coluna. Feito para a prova inteira, da largada na água até a chegada.",
    categorySlug: "triathlon",
    priceCents: 54900,
    compareAtCents: null,
    badges: ["Triathlon"],
    tags: ["triathlon", "drop-2026"],
    featured: true,
    highlights: ["Forro de secagem rápida", "Zíper nas costas", "Barra com silicone", "Tecido com compressão leve"],
    details: [
      { label: "Tecido", value: "Lycra técnica com compressão leve" },
      { label: "Forro", value: "Espuma fina de triathlon" },
      { label: "Fechamento", value: "Zíper traseiro" },
      { label: "Modelagem", value: "Justa" },
    ],
    care: "Enxaguar em água doce logo após o uso, principalmente depois de piscina ou mar. Lavar à mão. Secar à sombra.",
    images: [
      { url: img("macaquinho-branco"), alt: "Macaquinho Tri BORA branco, frente e costas", color: "Branco" },
      { url: img("macaquinho-preto"), alt: "Macaquinho Tri BORA preto, frente e costas", color: "Preto" },
      { url: img("macaquinho-duo"), alt: "Macaquinho Tri BORA nas duas cores" },
    ],
    variants: variants("macaquinho", [BRANCO, PRETO], BODY_SIZES, 8),
    position: 3,
  },
  {
    id: "bone-five-panel-bora",
    slug: "bone-five-panel-bora",
    name: "Boné Five Panel BORA",
    subtitle: "Leve, com aba flexível",
    description:
      "Five panel de corrida, leve e com aba flexível que dobra sem marcar. BORA em verde neon na frente e as curvas de nível da marca na lateral. Regulagem traseira para qualquer cabeça.",
    categorySlug: "acessorios",
    priceCents: 13900,
    compareAtCents: null,
    badges: [],
    tags: ["corrida", "essenciais"],
    featured: true,
    highlights: ["Ultraleve", "Aba flexível", "Regulagem traseira", "Faixa interna que absorve suor"],
    details: [
      { label: "Tecido", value: "Poliéster técnico" },
      { label: "Tamanho", value: "Único, ajustável" },
      { label: "Aba", value: "Flexível, dobrável" },
    ],
    care: "Lavar à mão com sabão neutro. Não colocar na máquina. Secar à sombra.",
    images: [
      { url: img("bone-five-panel"), alt: "Boné Five Panel BORA preto" },
      { url: img("bone-five-panel-detalhe"), alt: "Boné Five Panel BORA, detalhe da lateral" },
    ],
    variants: variants("bone", [PRETO], ["U"], 30),
    position: 4,
  },
  {
    id: "meia-bora-cano-alto",
    slug: "meia-bora-cano-alto",
    name: "Meia BORA Cano Alto",
    subtitle: "Compressão leve, presença forte",
    description:
      "Meia de corrida cano alto com compressão leve no arco, punho firme e calcanhar reforçado. Três cores: neon com as curvas de nível, preta com o letz BORAAA!! e branca com o escudo.",
    categorySlug: "acessorios",
    priceCents: 5900,
    compareAtCents: null,
    badges: [],
    tags: ["corrida", "essenciais"],
    featured: false,
    highlights: ["Compressão leve no arco", "Calcanhar e ponta reforçados", "Não escorrega", "Respirável"],
    details: [
      { label: "Composição", value: "Poliamida, algodão e elastano" },
      { label: "Cano", value: "Alto" },
    ],
    care: "Lavar do avesso em água fria. Não usar alvejante. Secar à sombra.",
    images: [
      { url: img("meia-neon"), alt: "Meia BORA verde neon", color: "Verde Neon" },
      { url: img("meia-preta"), alt: "Meia BORA preta", color: "Preto" },
      { url: img("meia-branca"), alt: "Meia BORA branca", color: "Branco" },
      { url: img("meia-trio"), alt: "Meias BORA nas três cores" },
    ],
    variants: variants("meia", [NEON, PRETO, BRANCO], ["34-38", "39-43"], 40),
    position: 5,
  },
  {
    id: "kit-letz-bora",
    slug: "kit-letz-bora",
    name: "Kit letz BORA",
    subtitle: "Camiseta + boné + meia",
    description:
      "O uniforme completo do movimento num kit só: Camiseta Dri-Fit BORA, Boné Five Panel BORA e Meia BORA Cano Alto. Você escolhe a cor e o tamanho da camiseta; boné preto e meia na cor da camiseta.",
    categorySlug: "kits",
    priceCents: 27900,
    compareAtCents: 34700, // soma das três peças avulsas
    badges: ["Kit", "3 peças"],
    tags: ["kit", "drop-2026"],
    featured: true,
    highlights: ["3 peças", "Preço de kit", "Pronto para a primeira largada"],
    details: [
      { label: "Inclui", value: "1 camiseta, 1 boné e 1 par de meias" },
      { label: "Meia", value: "Tamanho 39-43 (troca grátis para 34-38)" },
    ],
    care: "Siga a etiqueta de cada peça.",
    images: [
      { url: img("camiseta-neon-par"), alt: "Kit letz BORA com camiseta neon", color: "Verde Neon" },
      { url: img("camiseta-preta-par"), alt: "Kit letz BORA com camiseta preta", color: "Preto" },
      { url: img("bone-five-panel"), alt: "Boné do kit letz BORA" },
      { url: img("meia-trio"), alt: "Meias do kit letz BORA" },
    ],
    variants: variants("kit", [PRETO, NEON], SHIRT_SIZES, (_c, s) => (s === "XGG" || s === "PP" ? 4 : 15)),
    position: 6,
  },
  // ---------- Extra (oferta "leve junto" na sacola e no checkout). Pedido do Alex em 23/11/2026. ----------
  {
    id: "carbs-gel-bora-maracuja",
    slug: "carbs-gel-bora-maracuja",
    name: "CARBS Gel BORA - Maracujá - Pack com 5 unidades",
    subtitle: "5 sachês de 30g · sem cafeína",
    description: [
      "Desconto já aplicado: de R$ 64,50 por R$ 38,70, 40% de desconto. Menos de R$ 8 por sachê, e você retira junto com o seu pedido na Pampulha.",
      "CARBS Gel BORA é o novo lançamento da nossa assessoria, exclusivo para nossos atletas! Ele entrega energia rápida e hidratação com carboidratos e eletrólitos para melhor desempenho nos treinos e provas. É muito mais tecnologia e rendimento para os seus treinos e provas!",
      "O CARBS Gel BORA é um gel de carboidrato pensado para acompanhar a rotina esportiva com praticidade, leveza e energia imediata. Sua fórmula combina maltodextrina, glicose e frutose com eletrólitos essenciais para auxiliar na manutenção da energia e do desempenho durante o exercício, além de contribuir para a hidratação ao longo da atividade. Com textura fluida, sabor leve e fácil digestibilidade, é uma opção confortável para diferentes tipos de treino, desde sessões curtas até exercícios prolongados e provas.",
      "O sabor MARACUJÁ é o mais pedido entre nossos atletas e a composição com 21g de carboidratos, 200mg de sódio e sem cafeína é perfeita para o seu dia a dia. O pack contém 5 unidades que não podem ser vendidas separadamente.",
    ].join("\n\n"),
    categorySlug: "nutricao",
    priceCents: 3870,
    compareAtCents: 6450,
    badges: ["40% off", "Lançamento"],
    tags: ["extra", "nutricao", "gel"],
    featured: false,
    highlights: ["21g de carboidratos", "200mg de sódio", "Sem cafeína", "Sem glúten"],
    details: [
      { label: "Sachês por pack", value: "5" },
      { label: "Porção", value: "30g (1 sachê) · 84 kcal" },
      { label: "Carboidratos", value: "21g por sachê" },
      { label: "Sódio", value: "200mg por sachê" },
      { label: "Cafeína", value: "0mg" },
      { label: "Sabor", value: "Maracujá" },
      { label: "Fabricante", value: "dobro" },
    ],
    care: "Consumir 5 min antes ou a cada 45 min de exercício, uma porção por vez. Conservar fechado, ao abrigo da luz, calor e umidade; depois de aberto, consumir na hora. Não é medicamento. Produto indicado para atletas maiores de 19 anos. Consulte um profissional da saúde.",
    images: [
      { url: img("carbs-gel-pack"), alt: "CARBS Gel BORA sabor maracujá: caixa e 5 sachês de 30g" },
      { url: img("carbs-gel-sache"), alt: "Sachê do CARBS Gel BORA, frente e verso" },
      { url: img("carbs-gel-composicao"), alt: "O que o CARBS Gel BORA contém e não contém" },
      { url: img("carbs-gel-tabela"), alt: "Tabela nutricional do CARBS Gel BORA" },
      { url: img("carbs-gel-caixa"), alt: "Caixa do CARBS Gel BORA, frente e verso" },
    ],
    options: [{ name: "Sabor", values: [{ value: "Maracujá" }] }],
    variants: [
      // ESTOQUE PROVISÓRIO: confirmar com o Alex quantos packs há para vender.
      { id: "carbs-gel-mrc-5", sku: "CARBS-GEL-MRC-5", color: "Maracujá", colorHex: "#c8e63c", size: "U", priceCents: null, stock: 100, options: { Sabor: "Maracujá" }, barcode: "7898978610082" },
    ],
    position: 7,
  },
];

// Só as peças da Coleção do Alex (pasta "Coleção Bora Assessoria v1") ficam à venda, mais os extras. O resto fica oculto (draft), pronto para voltar.
export const VISIBLE_SLUGS = ["camiseta-letz-bora-algodao", "regata-cropped-bora", "carbs-gel-bora-maracuja"];
export const PRODUCTS: Product[] = ALL_PRODUCTS.map((p) => ({ ...p, status: VISIBLE_SLUGS.includes(p.slug) ? "active" : "draft" }));

// Cupons de exemplo (provisórios).
export const COUPONS: Coupon[] = [
  { code: "LETZBORA", kind: "percent", value: 10, minSubtotalCents: 0, active: true, expiresAt: null },
  { code: "FRETEBORA", kind: "free_shipping", value: 0, minSubtotalCents: 15000, active: true, expiresAt: null },
  // Espelho do cupom do banco, para testar limite e prazo no modo local (os usos contam os pedidos de .data/loja.json).
  { code: "BORA90", title: "BORA 90", kind: "percent", value: 90, minSubtotalCents: 0, active: true, expiresAt: "2026-11-27T23:59:59-03:00", maxUses: 10 },
];
