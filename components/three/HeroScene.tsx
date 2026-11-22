"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, Line, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import BoraShield from "./BoraShield";
import { stadiumPoints, stadiumShape } from "./shapes";
import { track } from "@/lib/analytics";

function useReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Textura do degradê da pista (verde neon que some, como no PISTA PATTERN da marca).
function useTrackTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 4;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, "#ceff00");
    grad.addColorStop(0.55, "#e6ff80");
    grad.addColorStop(1, "rgba(206,255,0,0.05)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Track({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const tex = useTrackTexture();
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(stadiumShape(5.2, 2.6, 0.42), { depth: 0.06, bevelEnabled: false, curveSegments: 64 });
    // UV em x de ponta a ponta para o degradê correr pela pista.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + 5.2) / 10.4;
      uv[i * 2 + 1] = 0.5;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  }, []);
  const lanes = useMemo(() => [2.46, 2.32].map((r) => stadiumPoints(5.2, r)), []);
  const checker = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 16;
    const g = c.getContext("2d")!;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 ? "#0a0a0a" : "#ffffff";
      g.fillRect(x * 8, y * 8, 8, 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    return t;
  }, []);

  useFrame((_, dt) => {
    if (ref.current && !reduced) ref.current.rotation.z += dt * 0.06;
  });

  return (
    <group rotation={[-1.18, 0, 0.18]} position={[0, -0.35, -0.4]}>
      <group ref={ref}>
        <mesh geometry={geo} receiveShadow>
          <meshStandardMaterial map={tex} transparent roughness={0.5} />
        </mesh>
        {lanes.map((pts, i) => (
          <Line key={i} points={pts} color="#ffffff" lineWidth={1.2} transparent opacity={0.85} position={[0, 0, 0.065]} />
        ))}
        <mesh position={[-2.2, -2.39, 0.07]}>
          <planeGeometry args={[0.42, 0.105]} />
          <meshBasicMaterial map={checker} />
        </mesh>
      </group>
    </group>
  );
}

function Rig({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const targetY = reduced ? 0 : state.pointer.x * 0.45 + Math.sin(t * 0.35) * 0.18;
    const targetX = reduced ? 0 : -state.pointer.y * 0.25;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, targetY, 3, dt);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, targetX, 3, dt);
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroScene({ className }: { className?: string }) {
  const reduced = !!useReducedMotion();
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 11], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      shadows
      onCreated={() => track("experiencia_3d_start", { scene: "home", load_ms: Math.round(performance.now()) })}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <Rig reduced={reduced}>
        <Float speed={reduced ? 0 : 1.6} rotationIntensity={0.25} floatIntensity={0.6}>
          <BoraShield scale={0.4} position={[0, 0.35, 0.4]} rotation={[0.05, -0.38, 0]} />
        </Float>
        <Track reduced={reduced} />
        <Sparkles count={60} scale={[9, 5, 4]} size={2.2} speed={reduced ? 0 : 0.35} color="#9fbf00" opacity={0.7} />
      </Rig>
      <ContactShadows position={[0, -2.35, 0]} opacity={0.32} scale={12} blur={2.6} far={4} />
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 4, 3]} scale={[10, 2, 1]} form="rect" />
        <Lightformer intensity={1.4} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} form="rect" />
        <Lightformer intensity={1.2} position={[5, -1, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} form="rect" />
        <Lightformer intensity={0.8} color="#ceff00" position={[0, -3, 2]} scale={[8, 1, 1]} form="rect" />
      </Environment>
    </Canvas>
  );
}
