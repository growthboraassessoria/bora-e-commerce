import type { Metadata } from "next";
import { connection } from "next/server";
import MyOrders from "@/components/orders/MyOrders";

export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false, follow: false } };

// Dinâmica de propósito: fica fora da porta da loja (pós-compra) e o StoreGate precisa ler o cabeçalho do proxy.
export default async function MeusPedidosPage() {
  await connection();
  return (
    <section className="wrap pt-6 sm:pt-16 pb-8">
      <div className="max-w-3xl">
        <p className="eyebrow">Pós-compra</p>
        <h1 className="display text-[clamp(44px,7vw,92px)] mt-3">Meus <span className="mark">pedidos.</span></h1>
        <p className="mt-4 sm:mt-5 text-[17px] sm:text-lg text-ink-2 max-w-xl">Digite o CPF e o celular usados na compra para ver seus pedidos, o status e o passe de retirada.</p>
      </div>
      <div className="mt-7 sm:mt-10"><MyOrders /></div>
    </section>
  );
}
