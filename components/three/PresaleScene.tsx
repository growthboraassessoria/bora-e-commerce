"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Image, Lightformer, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import BoraShield from "./BoraShield";
import { track } from "@/lib/analytics";

// Contorno livre de uma lagoa (não é o traçado oficial da prova): uma volta fechada e orgânica.
const LOOP: [number, number][] = [
  [-3.6, 0.2], [-3.1, 1.5], [-1.9, 2.1], [-0.6, 1.7], [0.5, 2.3], [1.9, 2.0], [3.0, 1.1], [3.7, -0.1],
  [3.2, -1.3], [2.0, -1.6], [1.1, -2.3], [-0.3, -2.0], [-1.4, -2.4], [-2.7, -1.7], [-3.5, -0.9],
];

function useReduced() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function Route({ reduced }: { reduced: boolean }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(LOOP.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal"), []);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 400, 0.035, 12, true), [curve]);
  const glow = useMemo(() => new THREE.TubeGeometry(curve, 400, 0.16, 12, true), [curve]);
  const marks = useMemo(() => Array.from({ length: 18 }, (_, i) => curve.getPointAt(i / 18)), [curve]);
  const runner = useRef<THREE.Group>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const TRAIL = 28;

  useFrame((state) => {
    const t = reduced ? 0.12 : (state.clock.elapsedTime * 0.045) % 1;
    const p = curve.getPointAt(t);
    runner.current?.position.copy(p);
    if (trail.current) {
      for (let i = 0; i < TRAIL; i++) {
        const q = curve.getPointAt((t - i * 0.004 + 1) % 1);
        tmp.position.copy(q);
        const s = 1 - i / TRAIL;
        tmp.scale.setScalar(0.09 * s + 0.01);
        tmp.updateMatrix();
        trail.current.setMatrixAt(i, tmp.matrix);
      }
      trail.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group rotation={[-1.05, 0, 0.12]} position={[0.6, -0.9, -0.6]}>
      <mesh geometry={glow}>
        <meshBasicMaterial color="#ceff00" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh geometry={tube}>
        <meshStandardMaterial color="#ceff00" emissive="#ceff00" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {marks.map((m, i) => (
        <mesh key={i} position={m}>
          <sphereGeometry args={[i === 0 ? 0.09 : 0.045, 16, 16]} />
          <meshBasicMaterial color={i === 0 ? "#ffffff" : "#8a8a8a"} toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh ref={trail} args={[undefined, undefined, TRAIL]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#ceff00" transparent opacity={0.55} toneMapped={false} />
      </instancedMesh>
      <group ref={runner}>
        <mesh>
          <sphereGeometry args={[0.12, 24, 24]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <pointLight color="#ceff00" intensity={4} distance={3} />
      </group>
    </group>
  );
}

function Rig({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const { size } = useThree();
  const narrow = size.width < 820;
  // Desktop: composição na metade direita (o texto fica à esquerda). Celular: menor e no alto.
  const layout = narrow ? { scale: 0.36, position: [0, 1.55, 0] as const } : { scale: 0.92, position: [1.2, 0.05, 0] as const };
  useFrame((state, dt) => {
    if (!ref.current || reduced) return;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, state.pointer.x * 0.22, 2.5, dt);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, -state.pointer.y * 0.12, 2.5, dt);
  });
  return (
    <group position={layout.position as unknown as [number, number, number]} scale={layout.scale}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

function Cards({ images }: { images: [string, string] }) {
  const { size } = useThree();
  if (size.width < 820) return null;
  return (
    <>
      <Float speed={1.3} rotationIntensity={0.25} floatIntensity={0.6}>
        <group position={[2.35, 0.75, -0.6]} rotation={[0, -0.42, 0.04]}>
          <mesh position={[0, 0, -0.02]}><planeGeometry args={[1.86, 2.3]} /><meshBasicMaterial color="#1a1a1a" /></mesh>
          <Image url={images[0]} scale={[1.8, 2.24]} toneMapped={false} />
        </group>
      </Float>
      <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7}>
        <group position={[1.45, -1.2, 0.7]} rotation={[0, -0.3, -0.05]}>
          <mesh position={[0, 0, -0.02]}><planeGeometry args={[1.46, 1.8]} /><meshBasicMaterial color="#1a1a1a" /></mesh>
          <Image url={images[1]} scale={[1.4, 1.74]} toneMapped={false} />
        </group>
      </Float>
    </>
  );
}

export default function PresaleScene({ images }: { images: [string, string] }) {
  const reduced = !!useReduced();
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.3, 9], fov: 34 }} gl={{ antialias: true, alpha: true }} onCreated={() => track("experiencia_3d_start", { scene: "volta-18k", load_ms: Math.round(performance.now()) })}>
      <fog attach="fog" args={["#070707", 9, 20]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 5]} intensity={1.4} />
      <Rig reduced={reduced}>
        <Route reduced={reduced} />
        <Float speed={reduced ? 0 : 1.4} rotationIntensity={0.3} floatIntensity={0.5}>
          <BoraShield scale={0.34} position={[0.2, 0.55, 0.4]} rotation={[0.05, -0.3, 0]} neonIntensity={0.7} />
        </Float>
        <Cards images={images} />
        <Sparkles count={90} scale={[12, 6, 6]} size={2} speed={reduced ? 0 : 0.3} color="#ceff00" opacity={0.6} />
      </Rig>
      <Environment resolution={256}>
        <Lightformer intensity={2.4} position={[0, 4, 3]} scale={[10, 2, 1]} />
        <Lightformer intensity={1.2} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer intensity={1.4} color="#ceff00" position={[0, -3, 2]} scale={[8, 1, 1]} />
      </Environment>
    </Canvas>
  );
}
