"use client";
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Image, Lightformer, Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";
import BoraShield from "./BoraShield";
import { track } from "@/lib/analytics";

export type Station = { slug: string; name: string; subtitle: string; price: string; image: string; kicker: string; title: string; text: string };

const GAP = 14; // distância entre estações
const SIDE = 2.6;

function Lanes({ length }: { length: number }) {
  // Pista reta com faixas brancas sobre o degradê neon, sumindo no horizonte.
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 1024;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 1024, 0, 0);
    grad.addColorStop(0, "#ceff00");
    grad.addColorStop(0.6, "#e9ff9a");
    grad.addColorStop(1, "#f5f5f1");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 1024);
    g.fillStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i <= 6; i++) g.fillRect(Math.round((i * 256) / 6) - 2, 0, 4, 1024);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.6, -length / 2 + 6]}>
      <planeGeometry args={[4.2, length + 12]} />
      <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  );
}

function ProductStation({ s, i }: { s: Station; i: number }) {
  const left = i % 2 === 0;
  const z = -(i + 1) * GAP;
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = (left ? 0.35 : -0.35) + Math.sin(state.clock.elapsedTime * 0.6 + i) * 0.04;
  });
  return (
    <group position={[left ? -SIDE : SIDE, 0.2, z]}>
      <group ref={ref}>
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[3.3, 3.9]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
        <Image url={s.image} scale={[3.1, 3.7]} toneMapped={false} />
        <mesh position={[0, -2.05, 0]}>
          <planeGeometry args={[3.3, 0.12]} />
          <meshBasicMaterial color="#ceff00" />
        </mesh>
      </group>
      <Text
        font="/fonts/Altone-Heavy.ttf"
        fontSize={0.9}
        color="#0a0a0a"
        anchorX="center"
        position={[left ? 3.3 : -3.3, 2.6, -2]}
        fillOpacity={0.07}
      >
        {String(i + 1).padStart(2, "0")}
      </Text>
    </group>
  );
}

// Escudo da abertura: à direita no desktop, menor e mais alto no celular.
function IntroShield() {
  const { size } = useThree();
  const narrow = size.width < 700;
  return (
    <Float speed={1.2} floatIntensity={0.5}>
      <BoraShield scale={narrow ? 0.24 : 0.36} position={narrow ? [0.6, 1.5, -2.5] : [2.3, 0.7, -2.5]} rotation={[0, -0.4, 0]} />
    </Float>
  );
}

// Progresso da rolagem nativa da página (0 a 1), lido a cada quadro pela câmera.
const progress = { target: 0, current: 0 };

function useScrollProgress(stations: Station[]) {
  useEffect(() => {
    // Analytics: cada estação alcançada na pista (uma vez por visita à página) e a chegada.
    const seen = new Set<number>();
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const step = Math.floor(progress.target * (stations.length + 1));
      for (let i = 1; i <= Math.min(step, stations.length + 1); i++) {
        if (seen.has(i)) continue;
        seen.add(i);
        if (i <= stations.length) track("experiencia_3d_progress", { station: i, slug: stations[i - 1].slug, total: stations.length });
        else track("experiencia_3d_complete", { total: stations.length });
      }
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [stations]);
}

function CameraRig({ total }: { total: number }) {
  const { camera } = useThree();
  useFrame((state, dt) => {
    progress.current = THREE.MathUtils.damp(progress.current, progress.target, 5, dt);
    const t = progress.current; // 0..1
    const z = 6 - t * (total + 1) * GAP;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, z, 4, dt);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, state.pointer.x * 0.6 + Math.sin(t * Math.PI * total) * 0.5, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.6 + state.pointer.y * 0.25, 3, dt);
    camera.lookAt(0, 0.1, camera.position.z - 8);
  });
  return null;
}

function Finale({ z }: { z: number }) {
  return (
    <group position={[0, 1.9, z - 2]}>
      <Float speed={1.4} floatIntensity={0.8} rotationIntensity={0.3}>
        <BoraShield scale={0.32} neonIntensity={0.6} />
      </Float>
      <Text font="/fonts/Altone-Heavy.ttf" fontSize={1.6} color="#0a0a0a" position={[0, -0.2, -4]} fillOpacity={0.06} anchorX="center">
        letz BORAAA!!
      </Text>
    </group>
  );
}

export default function ExperienceScene({ stations }: { stations: Station[] }) {
  const total = stations.length;
  useScrollProgress(stations);
  return (
    <div className="relative">
      <div className="fixed inset-0">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0.6, 6], fov: 45 }} gl={{ antialias: true }} onCreated={() => track("experiencia_3d_start", { scene: "experiencia", stations: stations.length, load_ms: Math.round(performance.now()) })}>
          <color attach="background" args={["#f5f5f1"]} />
          <fog attach="fog" args={["#f5f5f1", 10, 34]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 6, 4]} intensity={1.3} />
          <Environment resolution={128}>
            <Lightformer intensity={2} position={[0, 4, 3]} scale={[10, 2, 1]} />
            <Lightformer intensity={1} position={[-4, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
            <Lightformer intensity={0.7} color="#ceff00" position={[0, -2, 2]} scale={[8, 1, 1]} />
          </Environment>
          <CameraRig total={total} />
          <Lanes length={(total + 2) * GAP} />
          <IntroShield />
          {stations.map((s, i) => (
            <ProductStation key={s.slug} s={s} i={i} />
          ))}
          <Finale z={-(total + 1) * GAP} />
          <Sparkles count={160} scale={[10, 6, (total + 2) * GAP]} position={[0, 0.5, -((total + 2) * GAP) / 2]} size={2.4} speed={0.3} color="#8aa800" />
        </Canvas>
      </div>
      <div className="relative">
        <Overlay stations={stations} />
      </div>
    </div>
  );
}

function Overlay({ stations }: { stations: Station[] }) {
  return (
    <div className="w-screen text-ink">
      <section className="relative h-screen flex flex-col justify-end pb-[14vh] wrap [&>*:not(:first-child)]:relative">
        <div className="absolute inset-y-0 left-0 w-[min(860px,100%)] pointer-events-none" style={{ background: "linear-gradient(90deg, #f5f5f1 0%, rgba(245,245,241,0.94) 55%, rgba(245,245,241,0) 100%)" }} />
        <p className="eyebrow">BORA · Experiência</p>
        <h1 className="display text-[clamp(52px,11vw,180px)] mt-4">
          Corra<br />pela <span className="mark">loja.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg text-ink-2">Role para baixo. Cada estação da pista é uma peça do drop 2026, com a história de por que ela existe.</p>
        <p className="mt-10 text-sm font-bold tracking-widest uppercase animate-pulse">↓ Role para largar</p>
      </section>
      {stations.map((s, i) => {
        const left = i % 2 === 0;
        return (
          <section key={s.slug} className={`h-screen flex items-center wrap ${left ? "justify-end" : "justify-start"}`}>
            <div className="max-w-sm bg-white/85 backdrop-blur-md rounded-3xl p-7 shadow-[var(--shadow-float)]">
              <p className="eyebrow">{String(i + 1).padStart(2, "0")} · {s.kicker}</p>
              <h2 className="text-3xl font-black tracking-tight mt-3 leading-none">{s.title}</h2>
              <p className="mt-3 text-ink-2 leading-relaxed">{s.text}</p>
              <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-sm text-ink-3">{s.price}</p>
                </div>
                <Link href={`/produto/${s.slug}`} className="btn btn-primary h-11 px-5 text-sm">Ver peça</Link>
              </div>
            </div>
          </section>
        );
      })}
      <section className="h-screen flex flex-col items-center justify-end pb-[12vh] text-center wrap">
        <p className="eyebrow">Chegada</p>
        <h2 className="display text-[clamp(44px,8vw,120px)] mt-3">Vista o<br /><span className="mark">movimento.</span></h2>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link href="/colecao/todos" className="btn btn-primary btn-lg">Ver toda a coleção</Link>
          <Link href="/lancamento/kit-letz-bora" className="btn btn-neon btn-lg">Kit letz BORA</Link>
        </div>
      </section>
    </div>
  );
}
