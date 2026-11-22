// Estado do pagamento para o BORA OS (Loja → Pagar.me). Público e sem segredo: só diz o que está ligado.
import { paymentProvider } from "@/lib/server/payments";
import { pagarmeEnabled } from "@/lib/server/pagarme";
import { getPaymentRules } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const rules = await getPaymentRules();
  return Response.json(
    {
      gateway: paymentProvider(), // "pagarme" = cobrança real · "simulado" = nada é cobrado
      secretKey: pagarmeEnabled(),
      // Só o tipo da chave (teste ou produção), nunca a chave.
      secretKeyMode: !process.env.PAGARME_SECRET_KEY ? null : process.env.PAGARME_SECRET_KEY.startsWith("sk_test_") ? "teste" : process.env.PAGARME_SECRET_KEY.startsWith("sk_") ? "producao" : "desconhecido",
      publicKeyMode: !process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY ? null : process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY.startsWith("pk_test_") ? "teste" : "producao",
      publicKey: !!process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY,
      webhook: !!process.env.PAGARME_WEBHOOK_USER && !!process.env.PAGARME_WEBHOOK_PASSWORD,
      demo: process.env.NEXT_PUBLIC_SALES_DEMO === "1",
      rules,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
