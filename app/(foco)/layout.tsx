import FocoHeader from "@/components/ui/FocoHeader";

// Layout de foco (checkout, pagamento, obrigado): sem menu e sem barra de abas, para não tirar a atenção da compra.
export default function FocoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FocoHeader />
      <main className="min-h-[calc(100svh-64px)] bg-white">{children}</main>
    </>
  );
}
