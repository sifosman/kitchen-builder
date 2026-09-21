// Four edge ticks (L1 top / W2 right / L2 bottom / W1 left) — gold when the
// edging code bands that edge. Codes: '1' = all four, else comma list of
// L1/L2 (long edges) and W1/W2 (short edges) — see edgingLengthMm in bom.ts.
export function bandedEdges(edging: string): { l1: boolean; l2: boolean; w1: boolean; w2: boolean } {
  const e = edging.trim()
  if (e === '1') return { l1: true, l2: true, w1: true, w2: true }
  const parts = e.split(',').map(s => s.trim().toUpperCase())
  return {
    l1: parts.includes('L1'),
    l2: parts.includes('L2'),
    w1: parts.includes('W1'),
    w2: parts.includes('W2'),
  }
}

export default function EdgeTicks({ edging, size = 22 }: { edging: string; size?: number }) {
  const b = bandedEdges(edging)
  const gold = '#FFC400'
  const grey = '#D6D0C6'
  const t = size * 0.14
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 22 16" aria-hidden>
      <rect x={t / 2} y={t / 2} width={22 - t} height={16 - t} fill="none" stroke="#E6E2DA" strokeWidth={1} />
      {/* L1 top, W2 right, L2 bottom, W1 left */}
      <line x1={1} y1={t / 2} x2={21} y2={t / 2} stroke={b.l1 ? gold : grey} strokeWidth={t} />
      <line x1={22 - t / 2} y1={1} x2={22 - t / 2} y2={15} stroke={b.w2 ? gold : grey} strokeWidth={t} />
      <line x1={1} y1={16 - t / 2} x2={21} y2={16 - t / 2} stroke={b.l2 ? gold : grey} strokeWidth={t} />
      <line x1={t / 2} y1={1} x2={t / 2} y2={15} stroke={b.w1 ? gold : grey} strokeWidth={t} />
    </svg>
  )
}
