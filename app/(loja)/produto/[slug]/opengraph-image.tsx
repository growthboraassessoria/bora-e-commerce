import { ImageResponse } from "next/og";
import { getProduct } from "@/lib/server/catalog";
import { OG_SIZE, ogFonts, ogLogo, ogPhoto } from "@/lib/server/og";
import { brl } from "@/lib/money";
import { STORE } from "@/lib/config";
import { getPaymentRules } from "@/lib/server/settings";
import { pixBadge } from "@/lib/payment-rules";

// Imagem de compartilhamento do produto: foto, nome e preço, no visual da loja (branco + verde).
export const alt = "Produto da BORA Store";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const pixText = pixBadge(await getPaymentRules());
  const { slug } = await params;
  const [p, fonts, logo] = await Promise.all([getProduct(slug), ogFonts(), ogLogo()]);
  const photo = p?.images[0] ? await ogPhoto(p.images[0].url.replace("-1600", "-800")) : null;
  const name = p?.name ?? "BORA Store";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", fontFamily: "Altone", color: "#0a0a0a" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 56px 56px 64px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={176} height={45} alt="" />
            <div style={{ display: "flex", background: "#ceff00", padding: "4px 10px", borderRadius: 6, fontSize: 18, fontWeight: 900, letterSpacing: 3 }}>STORE</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p?.subtitle ? <div style={{ fontSize: 24, fontWeight: 700, color: "rgba(10,10,10,0.55)", textTransform: "uppercase", letterSpacing: 2 }}>{p.subtitle.slice(0, 48)}</div> : null}
            <div style={{ fontSize: name.length > 26 ? 60 : 76, fontWeight: 900, lineHeight: 0.95, letterSpacing: -2, textTransform: "uppercase", marginTop: 14 }}>{name}</div>
            {p ? (
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 28 }}>
                <div style={{ display: "flex", background: "#ceff00", padding: "8px 18px", fontSize: 48, fontWeight: 900 }}>{brl(p.priceCents)}</div>
                {pixText ? <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "rgba(10,10,10,0.66)" }}>{pixText}</div> : null}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "rgba(10,10,10,0.5)" }}>Retirada no evento · Pampulha, BH</div>
        </div>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} width={567} height={630} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ width: 567, height: 630, display: "flex", background: "#f5f5f1" }} />
        )}
      </div>
    ),
    { ...size, fonts },
  );
}
