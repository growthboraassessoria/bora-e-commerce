import { ImageResponse } from "next/og";
import { OG_SIZE, ogFonts, ogLogo } from "@/lib/server/og";
import { STORE } from "@/lib/config";
import { getPaymentRules } from "@/lib/server/settings";
import { pixBadge } from "@/lib/payment-rules";

// Imagem padrão de compartilhamento (WhatsApp, Instagram, Google): a marca em fundo branco com o verde como marca-texto.
export const alt = "BORA Store · Vista o movimento";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const pixText = pixBadge(await getPaymentRules());
  const [fonts, logo] = await Promise.all([ogFonts(), ogLogo()]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: "64px 72px", fontFamily: "Altone", color: "#0a0a0a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={234} height={60} alt="" />
          <div style={{ display: "flex", background: "#ceff00", padding: "6px 12px", borderRadius: 6, fontSize: 22, fontWeight: 900, letterSpacing: 4 }}>STORE</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, fontWeight: 900, lineHeight: 0.9, letterSpacing: -4, textTransform: "uppercase" }}>Vista o</div>
          <div style={{ display: "flex", marginTop: 10 }}>
            <div style={{ fontSize: 132, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4, textTransform: "uppercase", background: "#ceff00", padding: "0 18px" }}>movimento.</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 28, fontWeight: 700, color: "rgba(10,10,10,0.66)" }}>
          <div style={{ display: "flex" }}>Pré-venda Volta 18K · Edição Pampulha</div>
          {pixText ? <div style={{ display: "flex" }}>{pixText}</div> : null}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
