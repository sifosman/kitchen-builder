import { useState } from 'react'
import { useStore } from '../store'
import type { Obstruction, ObstructionKind, RoomShape } from '../engine/room'
import { wallCountForShape } from '../engine/room'

const KIND_LABELS: Record<ObstructionKind, string> = {
  plumbing: 'Sink / plumbing',
  hob: 'Stove / hob',
  fridge: 'Fridge',
  dishwasher: 'Dishwasher',
  window: 'Window',
  door: 'Door',
  block: 'Keep clear',
}

function KindIcon({ kind }: { kind: ObstructionKind }) {
  const props = {
    className: 'h-4 w-4',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const
  switch (kind) {
    case 'plumbing': // tap
      return (
        <svg {...props}>
          <path d="M6 12V8a4 4 0 0 1 8 0v4" />
          <path d="M4 12h10" />
          <path d="M14 10h4a2 2 0 0 1 2 2v2" />
          <path d="M18 16v2" />
        </svg>
      )
    case 'hob': // stove rings
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="2" />
          <circle cx="15.5" cy="10.5" r="2" />
          <circle cx="8.5" cy="15.5" r="1.4" />
          <circle cx="15.5" cy="15.5" r="1.4" />
        </svg>
      )
    case 'fridge':
      return (
        <svg {...props}>
          <rect x="6" y="3" width="12" height="18" rx="1.5" />
          <path d="M6 10h12" />
          <path d="M9 6.5v2M9 12.5v3" />
        </svg>
      )
    case 'dishwasher':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M4 9h16" />
          <path d="M8 6.5h8" />
        </svg>
      )
    case 'window':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M12 4v16M4 12h16" />
        </svg>
      )
    case 'door':
      return (
        <svg {...props}>
          <rect x="6" y="3" width="12" height="18" rx="1" />
          <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'block':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M6.5 6.5l11 11" />
        </svg>
      )
  }
}

const WALL_LABELS = ['Back wall', 'Left wall', 'Right wall']

let nextId = 100
const oid = () => `o${nextId++}`

function ShapeIcon({ shape }: { shape: RoomShape }) {
  const common = 'stroke-hds-black'
  return (
    <svg viewBox="0 0 48 36" className="h-9 w-12" fill="none" aria-hidden>
      {shape === 'straight' && (
        <rect x="4" y="6" width="40" height="8" rx="1.5" className={common} strokeWidth="2.5" />
      )}
      {shape === 'l-shape' && (
        <path d="M4 6h40v8H12v16H4V6Z" className={common} strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {shape === 'u-shape' && (
        <path d="M4 6h40v24h-8V14H12v16H4V6Z" className={common} strokeWidth="2.5" strokeLinejoin="round" />
      )}
    </svg>
  )
}

const SHAPES: { id: RoomShape; label: string; hint: string }[] = [
  { id: 'straight', label: 'Straight', hint: 'One wall' },
  { id: 'l-shape', label: 'L-shape', hint: 'Two walls' },
  { id: 'u-shape', label: 'U-shape', hint: 'Three walls' },
]

export default function RoomForm() {
  const { room, setRoom, generate } = useStore()
  const [moreOpen, setMoreOpen] = useState(false)

  const setShape = (shape: RoomShape) => {
    const count = wallCountForShape(shape)
    const walls = [...room.walls]
    while (walls.length < count) {
      walls.push({
        id: String.fromCharCode(65 + walls.length),
        label: WALL_LABELS[walls.length],
        lengthMm: 2400,
        obstructions: [],
      })
    }
    setRoom({ ...room, shape, walls: walls.slice(0, count) })
  }

  const setWallLength = (idx: number, lengthMm: number) => {
    const walls = room.walls.map((w, i) => (i === idx ? { ...w, lengthMm } : w))
    setRoom({ ...room, walls })
  }

  const addObstruction = (idx: number, kind: ObstructionKind) => {
    const defaults: Record<string, Partial<Obstruction>> = {
      door: { widthMm: 820 },
      window: { widthMm: 1200, sillHeightMm: 900, heightMm: 1200 },
      plumbing: { widthMm: 600 },
      hob: { widthMm: 600 },
      fridge: { widthMm: 900 },
      dishwasher: { widthMm: 600 },
      block: { widthMm: 300 },
    }
    const walls = room.walls.map((w, i) =>
      i === idx
        ? { ...w, obstructions: [...w.obstructions, { id: oid(), kind, offsetMm: 200, ...defaults[kind] } as Obstruction] }
        : w,
    )
    setRoom({ ...room, walls })
  }

  const updateObstruction = (wIdx: number, oId: string, patch: Partial<Obstruction>) => {
    const walls = room.walls.map((w, i) =>
      i === wIdx
        ? { ...w, obstructions: w.obstructions.map(o => (o.id === oId ? { ...o, ...patch } : o)) }
        : w,
    )
    setRoom({ ...room, walls })
  }

  const removeObstruction = (wIdx: number, oId: string) => {
    const walls = room.walls.map((w, i) =>
      i === wIdx ? { ...w, obstructions: w.obstructions.filter(o => o.id !== oId) } : w,
    )
    setRoom({ ...room, walls })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-hds-black">Tell us about your room</h2>
        <p className="mt-1 text-sm text-hds-muted">Pick a shape and give us the wall lengths — we'll do the rest.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-hds-black">Room shape</p>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map(s => (
            <button
              key={s.id}
              onClick={() => setShape(s.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-white px-2 py-3 transition-colors ${
                room.shape === s.id
                  ? 'border-hds-gold shadow-card'
                  : 'border-hds-border hover:border-hds-gold/60'
              }`}
            >
              <ShapeIcon shape={s.id} />
              <span className="text-sm font-semibold text-hds-black">{s.label}</span>
              <span className="text-[11px] text-hds-muted">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {room.walls.map((wall, wi) => (
          <div key={wall.id} className="rounded-xl border border-hds-border bg-hds-sand/60 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="hds-label">{WALL_LABELS[wi]}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={wall.lengthMm}
                    onChange={e => setWallLength(wi, Number(e.target.value) || 0)}
                    className="hds-input pr-12 text-lg font-semibold"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-hds-muted">mm</span>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-hds-muted">What's on this wall?</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(KIND_LABELS) as ObstructionKind[]).map(k => (
                  <button
                    key={k}
                    onClick={() => addObstruction(wi, k)}
                    className="flex items-center gap-1 rounded-full border border-hds-border bg-white px-2.5 py-1 text-xs font-medium text-hds-black transition-colors hover:border-hds-gold"
                  >
                    <KindIcon kind={k} /> {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>

            {wall.obstructions.map(o => (
              <div key={o.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-card">
                <span className="flex items-center gap-1.5 font-medium text-hds-black">
                  <KindIcon kind={o.kind} />{KIND_LABELS[o.kind]}
                </span>
                <label className="ml-auto text-xs text-hds-muted">from left</label>
                <input
                  type="number"
                  value={o.offsetMm}
                  onChange={e => updateObstruction(wi, o.id, { offsetMm: Number(e.target.value) || 0 })}
                  className="w-20 rounded-md border border-hds-border px-2 py-1 text-sm"
                />
                <label className="text-xs text-hds-muted">width</label>
                <input
                  type="number"
                  value={o.widthMm}
                  onChange={e => updateObstruction(wi, o.id, { widthMm: Number(e.target.value) || 0 })}
                  className="w-20 rounded-md border border-hds-border px-2 py-1 text-sm"
                />
                {o.kind === 'window' && (
                  <>
                    <label className="text-xs text-hds-muted">sill</label>
                    <input
                      type="number"
                      value={o.sillHeightMm ?? 900}
                      onChange={e => updateObstruction(wi, o.id, { sillHeightMm: Number(e.target.value) || 0 })}
                      className="w-20 rounded-md border border-hds-border px-2 py-1 text-sm"
                    />
                  </>
                )}
                <button
                  onClick={() => removeObstruction(wi, o.id)}
                  aria-label={`Remove ${KIND_LABELS[o.kind]}`}
                  className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-hds-muted transition-colors hover:bg-hds-sand hover:text-hds-black"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div>
        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex items-center gap-1 text-sm font-medium text-hds-muted hover:text-hds-black"
        >
          <span className={`inline-block transition-transform ${moreOpen ? 'rotate-90' : ''}`}>›</span>
          More options
        </button>
        {moreOpen && (
          <div className="mt-3 max-w-[180px]">
            <label className="hds-label">Ceiling height</label>
            <div className="relative">
              <input
                type="number"
                value={room.ceilingHeightMm}
                onChange={e => setRoom({ ...room, ceilingHeightMm: Number(e.target.value) || 2400 })}
                className="hds-input pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-hds-muted">mm</span>
            </div>
          </div>
        )}
      </div>

      <button onClick={generate} className="hds-btn-gold">
        Design my kitchen →
      </button>
    </div>
  )
}
