"use client";
import { useEffect, useRef, useState } from "react";
import { cart, cartCount, useCart } from "@/lib/cart";
import CartBagIcon from "./CartBagIcon";

export default function HeaderBag() {
  const { lines } = useCart();
  const count = cartCount(lines);
  const [bump, setBump] = useState(false);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current !== null && count > prev.current) { setBump(true); const t = setTimeout(() => setBump(false), 950); prev.current = count; return () => clearTimeout(t); }
    prev.current = count;
  }, [count]);
  return (
    <button type="button" onClick={() => cart.open()} className={`bag-btn relative size-10 grid place-items-center rounded-full bg-white/70 backdrop-blur hover:bg-white ${bump ? "bag-added" : ""}`} aria-label={`Sacola com ${count} itens`}>
      <span className="bag"><CartBagIcon size={24} /></span>
      {count > 0 ? <span className="bag-count absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-neon text-black text-[11px] font-black grid place-items-center ring-2 ring-white">{count}</span> : null}
    </button>
  );
}
