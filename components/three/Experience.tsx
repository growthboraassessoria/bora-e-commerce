"use client";
import dynamic from "next/dynamic";
import type { Station } from "./ExperienceScene";

const Scene = dynamic(() => import("./ExperienceScene"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 grid place-items-center"><p className="font-black uppercase tracking-widest animate-pulse">Preparando a pista…</p></div>,
});

export default function Experience({ stations }: { stations: Station[] }) {
  return <Scene stations={stations} />;
}
