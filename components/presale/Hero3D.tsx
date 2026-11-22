"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Scene = dynamic(() => import("@/components/three/PresaleScene"), { ssr: false, loading: () => null });

export default function PresaleHero3D({ images }: { images: [string, string] }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {}
  }, []);
  return ok ? <div className="absolute inset-0"><Scene images={images} /></div> : null;
}
