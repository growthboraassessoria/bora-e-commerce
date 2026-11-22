// Porta da loja: com a loja em modo "senha" (configurado no BORA OS), mostra a página de senha no lugar do site.
// Loja aberta: não lê cookie nem cabeçalho, então as páginas continuam estáticas/ISR.
// Loja com senha: o proxy.ts já troca as páginas pela /senha para quem não entrou; aqui é a segunda conferência
// (e libera as rotas de pós-compra que o proxy marcou com x-bora-gate: exempt).
import { headers } from "next/headers";
import { getStoreSettings, hasStoreAccess } from "@/lib/server/settings";
import PasswordPage from "./PasswordPage";

export default async function StoreGate({ children }: { children: React.ReactNode }) {
  const s = await getStoreSettings();
  if (s.status !== "password") return <>{children}</>;
  if (await hasStoreAccess(s)) return <>{children}</>;
  if ((await headers()).get("x-bora-gate") === "exempt") return <>{children}</>;
  return <PasswordPage message={s.passwordMessage} />;
}
