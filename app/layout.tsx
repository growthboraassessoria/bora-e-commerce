import type { Metadata, Viewport } from "next";
import { altone } from "./fonts";
import { SITE_URL, INDEXABLE, DEMO } from "@/lib/config";
import CartDrawer from "@/components/ui/CartDrawer";
import RouteSticker from "@/components/ui/RouteSticker";
import { TouchActive } from "@/components/ui/ios";
import Analytics from "@/components/analytics/Analytics";
import StoreGate from "@/components/store/StoreGate";
import PaymentRulesProvider from "@/components/store/PaymentRulesProvider";
import { getPaymentRules } from "@/lib/server/settings";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "BORA Store · Vista o movimento", template: "%s · BORA Store" },
  description: "BORA Store: pré-venda Volta 18K · Edição Pampulha. Camiseta LETZ BORA de algodão e regata cropped, retirada no evento na Pampulha. Pix ou cartão pela Pagar.me.",
  robots: INDEXABLE ? undefined : { index: false, follow: false },
  applicationName: "BORA Store",
  // A imagem padrão de compartilhamento vem de app/opengraph-image.tsx. Sem canonical aqui: cada página define o seu.
  openGraph: { type: "website", locale: "pt_BR", siteName: "BORA Store" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/img/marca/simbolo-black.png", apple: "/img/marca/simbolo-black.png" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const rules = await getPaymentRules();
  return (
    <html lang="pt-BR" className={altone.variable} data-scroll-behavior="smooth">
      <body>
        {DEMO ? (
          <div role="note" className="bg-neon text-black text-center text-[11px] sm:text-xs font-black uppercase tracking-[0.12em] px-4 py-2 leading-snug">
            Demonstração · as compras são simuladas e nada é cobrado
          </div>
        ) : null}
        <PaymentRulesProvider rules={rules}>
          <StoreGate>
            {children}
            <CartDrawer />
            <RouteSticker />
          </StoreGate>
        </PaymentRulesProvider>
        <Analytics />
        <TouchActive />
      </body>
    </html>
  );
}
