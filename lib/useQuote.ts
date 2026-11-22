"use client";
import { useEffect, useRef, useState } from "react";
import type { CartLine } from "./types";
import type { Quote } from "./server/quote";

export type { Quote };

// Pede ao servidor o orçamento do carrinho sempre que algo muda (com debounce curto).
export function useQuote(input: { lines: CartLine[]; coupon?: string; cep?: string; shippingId?: string; method?: "pix" | "card" }, enabled = true) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(input);
  const seq = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
        const data = await res.json();
        if (my === seq.current && res.ok) setQuote(data);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [key, enabled]);
  return { quote, loading };
}
