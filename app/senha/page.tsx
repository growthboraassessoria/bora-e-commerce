import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getStoreSettings, hasStoreAccess } from "@/lib/server/settings";
import PasswordPage from "@/components/store/PasswordPage";

export const metadata: Metadata = { title: "Acesso", robots: { index: false, follow: false } };

// Destino do proxy quando a loja está com senha (o endereço do navegador não muda).
// Aberta, ou com acesso liberado: só um atalho para a loja.
export default async function SenhaPage() {
  await connection();
  const s = await getStoreSettings();
  if (s.status === "password" && !(await hasStoreAccess(s))) return <PasswordPage message={s.passwordMessage} />;
  return (
    <div className="wrap py-24 text-center max-w-xl">
      <h1 className="display text-[clamp(40px,7vw,72px)]">A loja está <span className="mark">aberta.</span></h1>
      <Link href="/" className="btn btn-primary btn-lg mt-8">Entrar na loja</Link>
    </div>
  );
}
