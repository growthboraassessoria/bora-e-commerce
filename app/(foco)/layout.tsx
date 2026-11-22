import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { LockIcon } from "@/components/ui/Icons";

// Layout de foco (checkout, pagamento, obrigado): sem menu para não tirar a atenção da compra.
export default function FocoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="wrap h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Voltar à loja">
            <Logo className="h-[22px] w-auto" />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase bg-neon px-1.5 py-0.5 rounded-sm">Store</span>
          </Link>
          <p className="flex items-center gap-2 text-sm font-bold"><LockIcon size={16} /> Compra segura</p>
        </div>
      </header>
      <main className="min-h-[calc(100svh-64px)] bg-white">{children}</main>
    </>
  );
}
