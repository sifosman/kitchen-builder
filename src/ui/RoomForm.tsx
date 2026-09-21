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

const WALL_LABELS = ['Wall A (back)', 'Wall B (left)', 'Wall C (right)']

let nextId = 100
const oid = () => `o${nextId++}`

export default function RoomForm() {
  const { room, setRoom, generate } = useStore()

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
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Layout shape</label>
        <div className="flex gap-1">
          {(['straight', 'l-shape', 'u-shape'] as RoomShape[]).map(s => (
            <button
              key={s}
              onClick={() => setShape(s)}
              className={`px-3 py-1.5 rounded text-sm ${room.shape === s ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'}`}
            >
              {s === 'straight' ? 'Straight' : s === 'l-shape' ? 'L-shape' : 'U-shape'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ceiling height (mm)</label>
        <input
          type="number"
          value={room.ceilingHeightMm}
          onChange={e => setRoom({ ...room, ceilingHeightMm: Number(e.target.value) || 2400 })}
          className="w-28 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
        />
      </div>

      {room.walls.map((wall, wi) => (
        <div key={wall.id} className="border border-neutral-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-200 w-24">{WALL_LABELS[wi]}</span>
            <label className="text-xs text-gray-400">Length (mm)</label>
            <input
              type="number"
              value={wall.lengthMm}
              onChange={e => setWallLength(wi, Number(e.target.value) || 0)}
              className="w-28 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
            />
          </div>

          {wall.obstructions.map(o => (
            <div key={o.id} className="flex flex-wrap items-center gap-2 text-xs bg-neutral-900 rounded p-2">
              <span className="text-amber-400 font-medium w-24">{KIND_LABELS[o.kind]}</span>
              <label className="text-gray-500">from left</label>
              <input
                type="number"
                value={o.offsetMm}
                onChange={e => updateObstruction(wi, o.id, { offsetMm: Number(e.target.value) || 0 })}
                className="w-20 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5"
              />
              <label className="text-gray-500">width</label>
              <input
                type="number"
                value={o.widthMm}
                onChange={e => updateObstruction(wi, o.id, { widthMm: Number(e.target.value) || 0 })}
                className="w-20 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5"
              />
              {o.kind === 'window' && (
                <>
                  <label className="text-gray-500">sill</label>
                  <input
                    type="number"
                    value={o.sillHeightMm ?? 900}
                    onChange={e => updateObstruction(wi, o.id, { sillHeightMm: Number(e.target.value) || 0 })}
                    className="w-20 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5"
                  />
                </>
              )}
              <button onClick={() => removeObstruction(wi, o.id)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
            </div>
          ))}

          <div className="flex flex-wrap gap-1">
            {(Object.keys(KIND_LABELS) as ObstructionKind[]).map(k => (
              <button
                key={k}
                onClick={() => addObstruction(wi, k)}
                className="px-2 py-0.5 rounded bg-neutral-800 text-gray-300 text-xs hover:bg-neutral-700"
              >
                + {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={generate}
        className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm"
      >
        Generate layout
      </button>
    </div>
  )
}
