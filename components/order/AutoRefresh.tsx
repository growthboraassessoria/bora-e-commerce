"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Recarrega os dados da página a cada `every` ms (pagamento aguardando confirmação). Para depois de `max` ms.
export default function AutoRefresh({ every = 5000, max = 30 * 60_000 }: { every?: number; max?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), every);
    const stop = setTimeout(() => clearInterval(t), max);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [router, every, max]);
  return null;
}
