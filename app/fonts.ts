import localFont from "next/font/local";

// Altone, a família oficial da BORA (mesmos arquivos da LP).
export const altone = localFont({
  src: [
    { path: "./fonts/Altone-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Altone-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Altone-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Altone-Heavy.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-altone",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});
