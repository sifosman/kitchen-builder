// Combinatorial fit engine: room spec → ranked cabinet layout proposals.
// Per wall: pin fixed items (fridge, hob/oven, sink on plumbing, dishwasher
// beside sink) → remaining free spans are filled by enumerating library
// module widths + scribe fillers → scored per the CEO's rules.

import { getModule, type CabinetKind } from '../data/cabinetLibrary'
import type { RoomSpec, Wall } from './room'
import {
  CORNER_DEAD_BASE_MM,
  CORNER_DEAD_WALL_MM,
  FRIDGE_VENT_MM,
  FILLER_IDEAL_MAX_MM,
  FILLER_MAX_MM,
  FILLER_MIN_MM,
  scoreLayout,
  validateLayout,
  type PlacedUnit,
} from './rules'

export interface Proposal {
  id: string
  units: PlacedUnit[]
  score: number
  violations: string[]
  notes: string[]
}

const BASE_WIDTHS = [900, 600, 450, 300]
const DRAWER_WIDTHS = [450, 600, 900]
const SINK_WIDTHS = [600, 900, 1000]
const MAX_FILLER_MM = FILLER_MAX_MM

interface Zone { s: number; e: number }

function mergeZones(zones: Zone[]): Zone[] {
  const sorted = [...zones].sort((a, b) => a.s - b.s)
  const out: Zone[] = []
  for (const z of sorted) {
    const last = out[out.length - 1]
    if (last && z.s <= last.e) last.e = Math.max(last.e, z.e)
    else out.push({ ...z })
  }
  return out
}

function complement(zones: Zone[], length: number): Zone[] {
  const merged = mergeZones(zones.filter(z => z.e > 0 && z.s < length))
  const spans: Zone[] = []
  let cursor = 0
  for (const z of merged) {
    const s = Math.max(0, z.s)
    const e = Math.min(length, z.e)
    if (s > cursor) spans.push({ s: cursor, e: s })
    cursor = Math.max(cursor, e)
  }
  if (cursor < length) spans.push({ s: cursor, e: length })
  return spans
}

/** All non-increasing width multisets with sum ≤ target and leftover ≤ maxLeft. */
function widthCombos(target: number, widths: number[], maxLeftover = 300, cap = 60): number[][] {
  const out: number[][] = []
  const rec = (remaining: number, startIdx: number, acc: number[]) => {
    if (out.length >= cap) return
    const leftover = target - (acc.reduce((a, b) => a + b, 0))
    if (acc.length > 0 && leftover >= 0 && leftover <= maxLeftover) {
      out.push([...acc])
    }
    if (remaining <= 0) return
    for (let i = startIdx; i < widths.length; i++) {
      const w = widths[i]
      if (w > remaining) continue
      acc.push(w)
      rec(remaining - w, i, acc)
      acc.pop()
      if (out.length >= cap) return
    }
  }
  rec(target, 0, [])
  return out
}

function pickSinkWidth(plumbingWidth: number): number {
  return SINK_WIDTHS.find(w => w >= Math.max(600, plumbingWidth)) ?? 1000
}

function pickFridgeModule(width: number): string {
  return width <= 750 ? 'FRIDGE600' : 'FRIDGE900'
}

function fillerModuleId(width: number): string {
  if (width <= 60) return 'F50'
  if (width <= 90) return 'F80'
  return 'F100'
}

let counter = 0
function unit(moduleId: string, wallId: string, startMm: number, widthMm?: number, kind?: CabinetKind, mounted?: PlacedUnit['mounted']): PlacedUnit {
  const m = getModule(moduleId)
  return {
    instanceId: `${wallId}-${++counter}`,
    moduleId,
    wallId,
    startMm: Math.round(startMm),
    widthMm: widthMm ?? m.widthMm,
    kind: kind ?? m.kind,
    mounted: mounted ?? (m.kind === 'wall' ? 'wall' : m.kind === 'tall' ? 'tall' : m.kind === 'fridge' || m.kind === 'hob' || m.kind === 'dishwasher' ? 'appliance' : 'base'),
  }
}

interface WallPlan {
  wall: Wall
  fixed: PlacedUnit[]
  occupied: Zone[]        // base-level occupied
  wallOccupied: Zone[]    // wall-unit-level occupied
  spans: Zone[]
  wallSpans: Zone[]
  sinkUnit?: PlacedUnit
}

/** Pin the fixed items on one wall and compute fillable spans. */
function planWall(wall: Wall, wallIndex: number, room: RoomSpec): WallPlan {
  const fixed: PlacedUnit[] = []
  const occupied: Zone[] = []
  const wallOccupied: Zone[] = []
  let sinkUnit: PlacedUnit | undefined

  // corner dead-space: secondary walls lose the first 610mm (base) / 330mm (wall)
  if (wallIndex > 0) {
    occupied.push({ s: 0, e: Math.min(CORNER_DEAD_BASE_MM, wall.lengthMm) })
    wallOccupied.push({ s: 0, e: Math.min(CORNER_DEAD_WALL_MM, wall.lengthMm) })
  }

  const pendingDishwashers: Array<{ offsetMm: number; widthMm: number }> = []

  for (const o of wall.obstructions) {
    const s = o.offsetMm
    const e = o.offsetMm + o.widthMm
    switch (o.kind) {
      case 'door':
      case 'block':
        occupied.push({ s, e })
        wallOccupied.push({ s, e })
        break
      case 'window': {
        const sill = o.sillHeightMm ?? 900
        const top = sill + (o.heightMm ?? 1200)
        if (sill < 870) occupied.push({ s, e })
        if (top > 1450) wallOccupied.push({ s, e })
        break
      }
      case 'fridge': {
        const moduleId = pickFridgeModule(o.widthMm)
        const u = unit(moduleId, wall.id, s)
        fixed.push(u)
        occupied.push({ s: s - FRIDGE_VENT_MM, e: e + FRIDGE_VENT_MM })
        wallOccupied.push({ s, e }) // no wall units over the fridge slot either
        break
      }
      case 'hob': {
        const w = Math.max(600, o.widthMm)
        const start = Math.max(0, Math.min(wall.lengthMm - w, s + (o.widthMm - w) / 2))
        // oven unit itself stays 600 — centred inside wider zones
        const unitStart = start + Math.max(0, (w - 600) / 2)
        const u = unit('OVEN600', wall.id, unitStart, 600, 'oven')
        fixed.push(u)
        occupied.push({ s: start, e: start + w })
        wallOccupied.push({ s: start - 50, e: start + w + 50 }) // extractor zone
        break
      }
      case 'plumbing': {
        const w = pickSinkWidth(o.widthMm)
        const centre = s + o.widthMm / 2
        const start = Math.max(0, Math.min(wall.lengthMm - w, centre - w / 2))
        sinkUnit = unit(`SINK${w === 1000 ? 1000 : w}`, wall.id, start)
        fixed.push(sinkUnit)
        occupied.push({ s: start, e: start + w })
        break
      }
      case 'dishwasher':
        pendingDishwashers.push({ offsetMm: s, widthMm: Math.max(600, o.widthMm) })
        break
    }
  }

  // dishwashers sit beside the sink where possible, else at their marked spot
  for (const dw of pendingDishwashers) {
    const w = dw.widthMm
    let start: number | undefined
    if (sinkUnit) {
      const right = sinkUnit.startMm + sinkUnit.widthMm
      const left = sinkUnit.startMm - w
      const free = (a: number, b: number) =>
        a >= 0 && b <= wall.lengthMm &&
        !mergeZones(occupied).some(z => a < z.e && z.s < b)
      if (free(right, right + w)) start = right
      else if (free(left, left + w)) start = left
    }
    if (start === undefined) {
      start = Math.max(0, Math.min(wall.lengthMm - w, dw.offsetMm))
      if (mergeZones(occupied).some(z => start! < z.e && z.s < start! + w)) continue // can't place
    }
    const unitStart = start + Math.max(0, (w - 600) / 2)
    fixed.push(unit('DW600', wall.id, unitStart, 600, 'dishwasher'))
    occupied.push({ s: start, e: start + w })
    wallOccupied.push({ s: start, e: start + w })
  }

  const merged = mergeZones(occupied)
  const mergedWall = mergeZones(wallOccupied)
  return {
    wall,
    fixed,
    occupied: merged,
    wallOccupied: mergedWall,
    spans: complement(merged, wall.lengthMm).filter(z => z.e - z.s >= 50),
    wallSpans: complement(mergedWall, wall.lengthMm).filter(z => z.e - z.s >= 250),
    sinkUnit,
  }
}

interface FillResult {
  placements: PlacedUnit[]
  leftoverMm: number
}

/** Place a multiset of module widths + fillers into a span. */
function placeCombo(span: Zone, combo: number[], wallId: string, kindFor: (w: number, idx: number) => { moduleId: string; kind?: CabinetKind }, opts: { preferDrawerNear?: number } = {}): FillResult {
  const len = span.e - span.s
  const sum = combo.reduce((a, b) => a + b, 0)
  let leftover = len - sum
  const placements: PlacedUnit[] = []
  let x = span.s

  // order: largest modules first, drawer candidate nearest the sink/prep point
  const ordered = [...combo]
  if (opts.preferDrawerNear !== undefined) {
    // keep widths but we'll mark which index gets the drawer via kindFor
  }

  for (let i = 0; i < ordered.length; i++) {
    const w = ordered[i]
    const { moduleId, kind } = kindFor(w, i)
    placements.push(unit(moduleId, wallId, x, w, kind))
    x += w
  }

  // leftover → scribe filler(s) beside the last module, else leave as void
  if (leftover >= FILLER_MIN_MM) {
    if (leftover <= MAX_FILLER_MM) {
      placements.push(unit(fillerModuleId(leftover), wallId, x, leftover, 'filler'))
      leftover = 0
    } else if (leftover <= MAX_FILLER_MM * 2) {
      const f1 = Math.floor(leftover / 2)
      const f2 = leftover - f1
      placements.push(unit(fillerModuleId(f1), wallId, x, f1, 'filler'))
      placements.push(unit(fillerModuleId(f2), wallId, x + f1, f2, 'filler'))
      leftover = 0
    }
    // larger remainders stay as void (noted by caller)
  }
  return { placements, leftoverMm: leftover }
}

/**
 * Generate ranked layout proposals for a room.
 */
export function proposeLayouts(room: RoomSpec, maxProposals = 3): Proposal[] {
  counter = 0
  const plans = room.walls.map((w, i) => planWall(w, i, room))
  const proposals: Proposal[] = []

  // For each wall, build candidate fills per span: top combos × kind styles
  interface WallVariant { units: PlacedUnit[]; notes: string[] }
  const wallVariants: WallVariant[][] = plans.map(plan => {
    const variants: WallVariant[] = []
    const spanFills: FillResult[][] = plan.spans.map(span => {
      const len = span.e - span.s
      const combos = widthCombos(len, BASE_WIDTHS, MAX_FILLER_MM * 2)
      // rank combos: fewer modules, larger widths, small leftover
      combos.sort((a, b) => {
        const leftA = len - a.reduce((x, y) => x + y, 0)
        const leftB = len - b.reduce((x, y) => x + y, 0)
        const idealA = leftA === 0 || (leftA >= FILLER_MIN_MM && leftA <= FILLER_IDEAL_MAX_MM) ? 0 : 1
        const idealB = leftB === 0 || (leftB >= FILLER_MIN_MM && leftB <= FILLER_IDEAL_MAX_MM) ? 0 : 1
        if (idealA !== idealB) return idealA - idealB
        if (a.length !== b.length) return a.length - b.length
        return leftA - leftB
      })
      const top = combos.slice(0, 4)
      const fills: FillResult[] = []

      const sinkCentre = plan.sinkUnit ? plan.sinkUnit.startMm + plan.sinkUnit.widthMm / 2 : undefined

      for (const combo of top) {
        // style A: all door units
        fills.push(placeCombo(span, combo, plan.wall.id, w => ({ moduleId: `B${w}` })))
        // style B: swap the module nearest the sink for a drawer unit
        if (sinkCentre !== undefined) {
          let bestIdx = -1
          let bestDist = Infinity
          let x = span.s
          for (let i = 0; i < combo.length; i++) {
            const w = combo[i]
            const d = Math.abs(x + w / 2 - sinkCentre)
            if (DRAWER_WIDTHS.includes(w) && d < bestDist) { bestDist = d; bestIdx = i }
            x += w
          }
          if (bestIdx >= 0) {
            fills.push(placeCombo(span, combo, plan.wall.id, (w, i) =>
              i === bestIdx ? { moduleId: `D${w}`, kind: 'drawer' } : { moduleId: `B${w}` }))
          }
        }
      }
      if (fills.length === 0) {
        // span too small/awkward — full-width filler or void
        if (len >= FILLER_MIN_MM) {
          fills.push({ placements: [unit(fillerModuleId(Math.min(len, MAX_FILLER_MM)), plan.wall.id, span.s, Math.min(len, MAX_FILLER_MM), 'filler')], leftoverMm: len - Math.min(len, MAX_FILLER_MM) })
        } else {
          fills.push({ placements: [], leftoverMm: len })
        }
      }
      return fills.slice(0, 6)
    })

    // combine span fills (cap product at 12 variants per wall)
    const combine = (idx: number, acc: FillResult[]): void => {
      if (variants.length >= 12) return
      if (idx === spanFills.length) {
        const units: PlacedUnit[] = [...plan.fixed]
        const notes: string[] = []
        for (const f of acc) {
          units.push(...f.placements)
          if (f.leftoverMm > MAX_FILLER_MM) notes.push(`wall ${plan.wall.id}: ${Math.round(f.leftoverMm)}mm void left unfilled`)
        }
        // wall units: fill wallSpans with W modules
        for (const ws of plan.wallSpans) {
          const len = ws.e - ws.s
          const wCombos = widthCombos(len, [900, 600, 450, 300], MAX_FILLER_MM * 2)
          wCombos.sort((a, b) => a.length - b.length)
          const chosen = wCombos[0]
          if (chosen && chosen.length > 0) {
            const res = placeCombo(ws, chosen, plan.wall.id, w => ({ moduleId: `W${w}` }), {})
            for (const p of res.placements) p.mounted = 'wall'
            units.push(...res.placements)
          }
        }
        variants.push({ units, notes })
        return
      }
      for (const f of spanFills[idx]) {
        combine(idx + 1, [...acc, f])
        if (variants.length >= 12) return
      }
    }
    combine(0, [])
    if (variants.length === 0) {
      // no spans — fixed units only, plus wall units
      const units: PlacedUnit[] = [...plan.fixed]
      for (const ws of plan.wallSpans) {
        const len = ws.e - ws.s
        const wCombos = widthCombos(len, [900, 600, 450, 300], MAX_FILLER_MM * 2)
        wCombos.sort((a, b) => a.length - b.length)
        const chosen = wCombos[0]
        if (chosen && chosen.length > 0) {
          const res = placeCombo(ws, chosen, plan.wall.id, w => ({ moduleId: `W${w}` }), {})
          for (const p of res.placements) p.mounted = 'wall'
          units.push(...res.placements)
        }
      }
      variants.push({ units, notes: [] })
    }
    return variants
  })

  // cross-product of wall variants (cap 30)
  const signature = (units: PlacedUnit[]) =>
    units.map(u => `${u.wallId}:${u.moduleId}@${u.startMm}`).sort().join('|')
  const seen = new Set<string>()
  const combined: { units: PlacedUnit[]; notes: string[] }[] = []
  const cx = (wi: number, acc: PlacedUnit[], notes: string[]) => {
    if (combined.length >= 30) return
    if (wi === wallVariants.length) {
      const sig = signature(acc)
      if (!seen.has(sig)) {
        seen.add(sig)
        combined.push({ units: acc, notes })
      }
      return
    }
    for (const v of wallVariants[wi]) {
      cx(wi + 1, [...acc, ...v.units], [...notes, ...v.notes])
      if (combined.length >= 30) return
    }
  }
  cx(0, [], [])

  for (const c of combined) {
    const violations = validateLayout(c.units, room)
    const score = scoreLayout(c.units, room) - violations.length * 100
    proposals.push({
      id: `P${proposals.length + 1}`,
      units: c.units,
      score,
      violations,
      notes: c.notes,
    })
  }

  proposals.sort((a, b) => b.score - a.score)
  return proposals.slice(0, maxProposals).map((p, i) => ({ ...p, id: `P${i + 1}` }))
}
