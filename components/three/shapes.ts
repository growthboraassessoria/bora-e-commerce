import * as THREE from "three";

// Símbolo BORA (escudo com raio) redesenhado em coordenadas do PNG oficial (548 × 680), centro em (274, 340).
const S = 0.01;
const P = (x: number, y: number) => new THREE.Vector2((x - 274) * S, -(y - 340) * S);

function shieldPath(inset: number) {
  const l = 0 + inset, r = 548 - inset, t = 0 + inset, side = 400, b = 680 - inset;
  const s = new THREE.Shape();
  const a = P(l, t), bb = P(r, t), c = P(r, side), d = P(274, b), e = P(l, side);
  s.moveTo(a.x, a.y);
  s.lineTo(bb.x, bb.y);
  s.lineTo(c.x, c.y);
  const c1 = P(r, 560 - inset * 0.3), c2 = P(430 - inset * 0.6, b);
  s.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, d.x, d.y);
  const c3 = P(118 + inset * 0.6, b), c4 = P(l, 560 - inset * 0.3);
  s.bezierCurveTo(c3.x, c3.y, c4.x, c4.y, e.x, e.y);
  s.lineTo(a.x, a.y);
  return s;
}

function poly(points: [number, number][]) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => {
    const v = P(x, y);
    if (i === 0) s.moveTo(v.x, v.y);
    else s.lineTo(v.x, v.y);
  });
  s.closePath();
  return s;
}

const BOLT_TOP: [number, number][] = [[115, 330], [338, 102], [352, 100], [362, 114], [362, 335], [305, 335], [305, 200], [185, 335]];
const BOLT_BOTTOM: [number, number][] = BOLT_TOP.map(([x, y]) => [548 - x, 680 - y]);

export function shieldFrameShape() {
  const outer = shieldPath(0);
  const inner = shieldPath(34);
  outer.holes.push(new THREE.Path(inner.getPoints(48)));
  return outer;
}

export const shieldFaceShape = () => shieldPath(30);
export const boltShapes = () => [poly(BOLT_TOP), poly(BOLT_BOTTOM)];

// Pista de atletismo (estádio): retângulo com pontas em semicírculo, com furo.
export function stadiumShape(len: number, radius: number, width: number) {
  const make = (r: number) => {
    const s = new THREE.Shape();
    const h = len / 2;
    s.moveTo(-h, -r);
    s.lineTo(h, -r);
    s.absarc(h, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-h, r);
    s.absarc(-h, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
    return s;
  };
  const outer = make(radius);
  const inner = make(radius - width);
  outer.holes.push(new THREE.Path(inner.getPoints(96).reverse()));
  return outer;
}

export function stadiumPoints(len: number, radius: number, segments = 160) {
  const pts: THREE.Vector3[] = [];
  const h = len / 2;
  const perim = 2 * len + 2 * Math.PI * radius;
  for (let i = 0; i <= segments; i++) {
    let d = (i / segments) * perim;
    let x: number, y: number;
    if (d < len) { x = -h + d; y = -radius; }
    else if ((d -= len) < Math.PI * radius) { const a = -Math.PI / 2 + d / radius; x = h + Math.cos(a) * radius; y = Math.sin(a) * radius; }
    else if ((d -= Math.PI * radius) < len) { x = h - d; y = radius; }
    else { d -= len; const a = Math.PI / 2 + d / radius; x = -h + Math.cos(a) * radius; y = Math.sin(a) * radius; }
    pts.push(new THREE.Vector3(x, y, 0));
  }
  return pts;
}
