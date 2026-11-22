import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";
import TabBar from "@/components/ui/TabBar";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      {/* Celular: barra de abas no jeito do iOS (some no desktop). */}
      <TabBar />
    </>
  );
}
