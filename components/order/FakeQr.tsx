// Desenho de QR só para o modo simulado (não é um Pix de verdade).
export default function FakeQr({ seed }: { seed: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const n = 25;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    cells.push((h & 3) === 0 || (h & 7) === 1);
  }
  const finder = (x: number, y: number) => {
    const inF = (fx: number, fy: number) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
    for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) if (inF(fx, fy)) {
      const dx = x - fx, dy = y - fy;
      return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
    }
    return -1;
  };
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} className="w-full h-auto" role="img" aria-label="QR Code de teste">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      {cells.map((on, i) => {
        const x = i % n, y = Math.floor(i / n);
        const f = finder(x, y);
        const fill = f === -1 ? on : f === 1;
        return fill ? <rect key={i} x={x} y={y} width={1.02} height={1.02} fill="#0a0a0a" /> : null;
      })}
    </svg>
  );
}
