"use client";
// Coletor de analytics da loja: liga o motor (lib/analytics-client.ts), manda page_view em toda navegação
// e, se as variáveis existirem, carrega o GA4 e o Meta Pixel. Sem as variáveis, nada externo carrega.
import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { boot, currentPage, isOff, leavePage, pageView } from "@/lib/analytics-client";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function Analytics() {
  const [vendors, setVendors] = useState(false);
  useEffect(() => {
    boot();
    setVendors(!isOff());
  }, []);
  return (
    <>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      {vendors && GA_ID ? <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" /> : null}
      {vendors && PIXEL_ID ? <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" /> : null}
    </>
  );
}

function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    boot();
    const prev = currentPage();
    // Primeira página da aba: o título já está certo. Troca de rota: o título novo pode chegar
    // um pouco depois, então espera até 1 s por ele (filtro na mesma página não espera).
    const wait = prev.count > 0 && prev.path !== pathname;
    if (prev.count > 0) leavePage();
    const started = Date.now();
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!wait || document.title !== prev.title || Date.now() - started > 1000) return pageView(pathname, search);
      id = setTimeout(tick, 100);
    };
    id = setTimeout(tick, wait ? 60 : 30);
    return () => clearTimeout(id);
  }, [pathname, search]);
  return null;
}
