"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";

const HeroScene = dynamic(() => import("@/components/three/HeroScene"), { ssr: false, loading: () => <Fallback /> });

function Fallback() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <Image src="/img/marca/simbolo-black.png" alt="" width={220} height={280} className="w-[34%] max-w-[220px] h-auto opacity-90 animate-pulse" priority />
    </div>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Hero3D() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(hasWebGL()), []);
  if (ok === false) return <Fallback />;
  if (ok === null) return <Fallback />;
  return <HeroScene className="!absolute inset-0" />;
}
