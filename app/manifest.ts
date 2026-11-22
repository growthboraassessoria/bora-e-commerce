import type { MetadataRoute } from "next";

// Manifesto do app (atalho na tela inicial do celular). Cores da loja: fundo branco, verde da marca como destaque.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BORA Store",
    short_name: "BORA Store",
    description: "Loja da BORA: corrida, duathlon e triathlon. Pré-venda Volta 18K · Edição Pampulha.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["shopping", "sports", "lifestyle"],
    icons: [
      { src: "/img/marca/simbolo-black.png", sizes: "600x765", type: "image/png", purpose: "any" },
      { src: "/img/marca/logo-black.png", sizes: "1200x307", type: "image/png", purpose: "any" },
    ],
  };
}
