"use client";
import { useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { boltShapes, shieldFaceShape, shieldFrameShape } from "./shapes";

const bevel = { bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 6, curveSegments: 48 };

// Escudo BORA em 3D: moldura preta laqueada, face branca e o raio em verde neon saltado.
export default function BoraShield({ neonIntensity = 0.35, ...props }: ThreeElements["group"] & { neonIntensity?: number }) {
  const geo = useMemo(() => {
    const frame = new THREE.ExtrudeGeometry(shieldFrameShape(), { depth: 0.55, ...bevel });
    const face = new THREE.ExtrudeGeometry(shieldFaceShape(), { depth: 0.4, ...bevel, bevelThickness: 0.02, bevelSize: 0.02 });
    const bolt = new THREE.ExtrudeGeometry(boltShapes(), { depth: 0.32, ...bevel, bevelThickness: 0.05, bevelSize: 0.04 });
    for (const g of [frame, face, bolt]) g.translate(0, 0, -0.27);
    return { frame, face, bolt };
  }, []);

  return (
    <group {...props}>
      <mesh geometry={geo.frame} castShadow>
        <meshPhysicalMaterial color="#0b0b0b" roughness={0.18} metalness={0.25} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh geometry={geo.face} position={[0, 0, -0.02]} receiveShadow>
        <meshPhysicalMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.18} roughness={0.3} clearcoat={0.6} clearcoatRoughness={0.2} />
      </mesh>
      <mesh geometry={geo.bolt} position={[0, 0, 0.3]} castShadow>
        <meshPhysicalMaterial color="#ceff00" emissive="#9fd000" emissiveIntensity={neonIntensity} roughness={0.22} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
    </group>
  );
}
