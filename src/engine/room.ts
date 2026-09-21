// Room model — walls with obstructions positioned as offsets from the
// wall's left end (facing the wall from inside the room).

export type ObstructionKind =
  | 'door'        // full-height — blocks all cabinets
  | 'window'      // blocks wall units; blocks base units if sill < counter
  | 'plumbing'    // sink must be centred on this point/zone
  | 'hob'         // stove position — needs hob zone + extractor (no wall unit)
  | 'fridge'      // fridge slot — needs ventilation gaps
  | 'dishwasher'  // should sit beside the sink
  | 'block'       // generic "keep clear" zone (pillar, geyser, meters)

export interface Obstruction {
  id: string
  kind: ObstructionKind
  /** offset from the left end of the wall, mm */
  offsetMm: number
  widthMm: number
  /** windows: sill height above floor, mm (default 900) */
  sillHeightMm?: number
  /** windows: opening height, mm (default 1200) */
  heightMm?: number
}

export interface Wall {
  id: string
  label: string
  lengthMm: number
  obstructions: Obstruction[]
}

export type RoomShape = 'straight' | 'l-shape' | 'u-shape'

export interface RoomSpec {
  shape: RoomShape
  walls: Wall[]
  ceilingHeightMm: number
}

export function wallCountForShape(shape: RoomShape): number {
  return shape === 'straight' ? 1 : shape === 'l-shape' ? 2 : 3
}

/** Free spans on a wall after removing obstruction zones. */
export function freeSpans(wall: Wall, forWallUnits = false): Array<{ startMm: number; endMm: number }> {
  const blocked: Array<{ startMm: number; endMm: number }> = []
  for (const o of wall.obstructions) {
    const start = o.offsetMm
    const end = o.offsetMm + o.widthMm
    switch (o.kind) {
      case 'door':
      case 'block':
        blocked.push({ startMm: start, endMm: end })
        break
      case 'window': {
        const sill = o.sillHeightMm ?? 900
        const top = sill + (o.heightMm ?? 1200)
        if (forWallUnits) {
          // wall units hang 1450–2170 — blocked if the window intrudes
          if (top > 1450) blocked.push({ startMm: start, endMm: end })
        } else {
          // base units are blocked only if the sill is below counter height
          if (sill < 870) blocked.push({ startMm: start, endMm: end })
        }
        break
      }
      default:
        // plumbing/hob/fridge/dishwasher are placements, not blockers
        break
    }
  }
  blocked.sort((a, b) => a.startMm - b.startMm)
  const spans: Array<{ startMm: number; endMm: number }> = []
  let cursor = 0
  for (const b of blocked) {
    if (b.startMm > cursor) spans.push({ startMm: cursor, endMm: Math.min(b.startMm, wall.lengthMm) })
    cursor = Math.max(cursor, b.endMm)
  }
  if (cursor < wall.lengthMm) spans.push({ startMm: cursor, endMm: wall.lengthMm })
  return spans.filter(s => s.endMm - s.startMm > 0)
}
