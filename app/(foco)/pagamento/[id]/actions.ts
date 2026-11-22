"use server";
import { redirect } from "next/navigation";
import { checkOrderToken, getOrder, markOrderPaid } from "@/lib/server/orders";
import { paymentProvider } from "@/lib/server/payments";
import { rememberOrder } from "@/lib/server/order-cookie";

// Só existe no modo simulado (sem a Pagar.me configurada).
export async function simulateApproval(id: string, token: string) {
  if (paymentProvider() !== "simulado") throw new Error("Pagamento simulado desligado");
  if (!checkOrderToken(id, token)) throw new Error("Link inválido");
  const order = await getOrder(id);
  if (!order || order.paymentProvider !== "simulado") throw new Error("Pedido inválido");
  const paid = await markOrderPaid(id, `SIM-${Date.now()}`);
  if (paid) await rememberOrder(paid);
  redirect(`/obrigado/${id}?t=${token}`);
}
