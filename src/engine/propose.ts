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
const SINK_WIDTHS = [600, 900, 1000]
const MAX_FILLER_MM = FILLER_MAX_MM

interface Zone { s: number; e: number; hard?: boolean; hardLeft?: boolean; hardRight?: boolean }

function mergeZones(zones: Zone[]): Zone[] {
  const sorted = [...zones].sort((a, b) => a.s - b.s)
  const out: Zone[] = []
  for (const z of sorted) {
    const last = out[out.length - 1]
    if (last && z.s <= last.e) {
      last.e = Math.max(last.e, z.e)
      last.hard = last.hard || z.hard
    } else out.push({ ...z })
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
  spans: Zone[]           // each span carries hard-left/hard-right boundary flags
  wallSpans: Zone[]
  sinkUnit?: PlacedUnit
}

/**
 * Boundary hardness: an edge of a span is "hard" when it meets the wall end,
 * a corner dead-zone, a door/block/window, a fridge slot or a tall unit.
 * Edges beside a sink, oven/hob extractor zone or dishwasher are "soft" —
 * leftover space there is absorbed into a cabinet rather than filled.
 */
function withBoundaries(spans: Zone[], zones: Zone[], wallLen: number): Zone[] {
  return spans.map(span => {
    const left = span.s === 0 ? true : zones.find(z => z.e === span.s)?.hard ?? true
    const right = span.e === wallLen ? true : zones.find(z => z.s === span.e)?.hard ?? true
    return { ...span, hardLeft: left, hardRight: right }
  })
}

/** Pin the fixed items on one wall and compute fillable spans. */
function planWall(wall: Wall, wallIndex: number, room: RoomSpec): WallPlan {
  const fixed: PlacedUnit[] = []
  const occupied: Zone[] = []
  const wallOccupied: Zone[] = []
  let sinkUnit: PlacedUnit | undefined

  // corner dead-space: secondary walls lose the first 610mm (base) / 330mm (wall)
  const deadBase = wallIndex > 0 ? Math.min(CORNER_DEAD_BASE_MM, wall.lengthMm) : 0
  if (wallIndex > 0) {
    occupied.push({ s: 0, e: deadBase, hard: true })
    wallOccupied.push({ s: 0, e: Math.min(CORNER_DEAD_WALL_MM, wall.lengthMm), hard: true })
  }
  // floor-level fixed items must sit clear of the corner dead zone
  const clampFloor = (start: number, w: number) =>
    Math.min(Math.max(start, deadBase), Math.max(deadBase, wall.lengthMm - w))
  // footprints of fixed units already placed — a later appliance whose marked
  // zone overlaps a placed unit slides right past it instead of colliding
  const claimed: Zone[] = []
  const resolveStart = (start: number, w: number): number => {
    let s = start
    for (const c of [...claimed].sort((a, b) => a.s - b.s)) {
      if (s < c.e && c.s < s + w) s = c.e
    }
    return s
  }

  const pendingDishwashers: Array<{ offsetMm: number; widthMm: number }> = []

  for (const o of wall.obstructions) {
    const s = o.offsetMm
    const e = o.offsetMm + o.widthMm
    switch (o.kind) {
      case 'door':
      case 'block':
        occupied.push({ s, e, hard: true })
        wallOccupied.push({ s, e, hard: true })
        break
      case 'window': {
        const sill = o.sillHeightMm ?? 900
        const top = sill + (o.heightMm ?? 1200)
        if (sill < 870) occupied.push({ s, e, hard: true })
        if (top > 1450) wallOccupied.push({ s, e, hard: true })
        break
      }
      case 'fridge': {
        const moduleId = pickFridgeModule(o.widthMm)
        const u = unit(moduleId, wall.id, resolveStart(clampFloor(s, getModule(moduleId).widthMm), getModule(moduleId).widthMm))
        fixed.push(u)
        const uEnd = u.startMm + u.widthMm
        claimed.push({ s: u.startMm, e: uEnd })
        // the reserved zone must cover the unit wherever it actually landed
        occupied.push({ s: Math.min(s, u.startMm) - FRIDGE_VENT_MM, e: Math.max(e, uEnd) + FRIDGE_VENT_MM, hard: true })
        wallOccupied.push({ s: Math.min(s, u.startMm), e: Math.max(e, uEnd), hard: true }) // no wall units over the fridge slot either
        break
      }
      case 'hob': {
        const w = Math.max(600, o.widthMm)
        const start = clampFloor(Math.min(wall.lengthMm - w, s + (o.widthMm - w) / 2), w)
        // oven unit itself stays 600 — centred inside wider zones, but never
        // inside another fixed unit's footprint
        const unitStart = Math.min(resolveStart(start + Math.max(0, (w - 600) / 2), 600), Math.max(deadBase, wall.lengthMm - 600))
        const u = unit('OVEN600', wall.id, unitStart, 600, 'oven')
        fixed.push(u)
        claimed.push({ s: u.startMm, e: u.startMm + u.widthMm })
        occupied.push({ s: start, e: Math.max(start + w, u.startMm + u.widthMm), hard: false })
        wallOccupied.push({ s: start - 50, e: Math.max(start + w, u.startMm + u.widthMm) + 50, hard: false }) // extractor zone
        break
      }
      case 'plumbing': {
        const w = pickSinkWidth(o.widthMm)
        const centre = s + o.widthMm / 2
        const start = resolveStart(clampFloor(Math.min(wall.lengthMm - w, centre - w / 2), w), w)
        sinkUnit = unit(`SINK${w === 1000 ? 1000 : w}`, wall.id, start)
        fixed.push(sinkUnit)
        claimed.push({ s: start, e: start + w })
        occupied.push({ s: start, e: start + w, hard: false })
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
      start = clampFloor(Math.min(wall.lengthMm - w, dw.offsetMm), w)
      if (mergeZones(occupied).some(z => start! < z.e && z.s < start! + w)) continue // can't place
    }
    const unitStart = start + Math.max(0, (w - 600) / 2)
    const dwUnit = unit('DW600', wall.id, unitStart, 600, 'dishwasher')
    fixed.push(dwUnit)
    claimed.push({ s: dwUnit.startMm, e: dwUnit.startMm + dwUnit.widthMm })
    occupied.push({ s: start, e: start + w, hard: false })
    wallOccupied.push({ s: start, e: start + w, hard: false })
  }

  const merged = mergeZones(occupied)
  const mergedWall = mergeZones(wallOccupied)
  const spans = complement(merged, wall.lengthMm).filter(z => z.e - z.s >= 50)
  const wallSpans = complement(mergedWall, wall.lengthMm).filter(z => z.e - z.s >= 250)
  return {
    wall,
    fixed,
    occupied: merged,
    wallOccupied: mergedWall,
    spans: withBoundaries(spans, merged, wall.lengthMm),
    wallSpans: withBoundaries(wallSpans, mergedWall, wall.lengthMm),
    sinkUnit,
  }
}

interface FillResult {
  placements: PlacedUnit[]
  leftoverMm: number
}

/**
 * Place a multiset of module widths into a span and resolve the leftover:
 *  - L === 0            → nothing
 *  - 0 < L < 20         → widen the widest non-drawer unit (cut-to-size)
 *  - 20 ≤ L ≤ 80 + hard boundary → one filler at the hard end (prefer the
 *    wall-end / tall-unit side, else the end farther from the sink)
 *  - otherwise          → absorb L into units (widen widest ≤1000, then split)
 * Fillers therefore only ever sit against a hard boundary, never mid-run.
 */
function placeCombo(
  span: Zone,
  combo: number[],
  wallId: string,
  kindFor: (w: number, idx: number) => { moduleId: string; kind?: CabinetKind },
  opts: { sinkCentre?: number; wallLenMm: number },
): FillResult {
  const len = span.e - span.s
  const sum = combo.reduce((a, b) => a + b, 0)
  let leftover = len - sum
  const placements: PlacedUnit[] = []
  let x = span.s
  for (let i = 0; i < combo.length; i++) {
    const w = combo[i]
    const { moduleId, kind } = kindFor(w, i)
    placements.push(unit(moduleId, wallId, x, w, kind))
    x += w
  }

  const repack = () => {
    let pos = span.s
    for (const p of placements) {
      p.startMm = Math.round(pos)
      pos += p.widthMm
    }
  }

  /** Widen the widest non-drawer unit(s) by `amount`; returns unabsorbed rest. */
  const absorb = (amount: number): number => {
    let remaining = amount
    const candidates = [...placements].filter(p => p.kind !== 'drawer').sort((a, b) => b.widthMm - a.widthMm)
    for (const p of candidates) {
      if (remaining <= 0) break
      const add = Math.min(1000 - p.widthMm, remaining)
      if (add <= 0) continue
      p.widthMm += add
      p.moduleId = kindFor(p.widthMm, 0).moduleId
      remaining -= add
    }
    repack()
    return remaining
  }

  if (leftover <= 0) return { placements, leftoverMm: Math.max(0, leftover) }

  if (leftover < FILLER_MIN_MM) {
    leftover = absorb(leftover)
    return { placements, leftoverMm: leftover }
  }

  if (leftover <= FILLER_IDEAL_MAX_MM && (span.hardLeft || span.hardRight)) {
    // one filler at the hard end — wall end / tall side wins, then the end
    // farther from the sink
    let atLeft: boolean
    if (span.hardLeft && span.hardRight) {
      if (span.s === 0) atLeft = true
      else if (span.e === opts.wallLenMm) atLeft = false
      else if (opts.sinkCentre !== undefined) {
        atLeft = Math.abs(span.s - opts.sinkCentre) >= Math.abs(span.e - opts.sinkCentre)
      } else atLeft = false
    } else {
      atLeft = !!span.hardLeft
    }
    const f = unit(fillerModuleId(leftover), wallId, atLeft ? span.s : span.e - leftover, leftover, 'filler')
    if (atLeft) {
      for (const p of placements) p.startMm += leftover
      placements.unshift(f)
    } else {
      placements.push(f)
    }
    return { placements, leftoverMm: 0 }
  }

  leftover = absorb(leftover)
  return { placements, leftoverMm: leftover }
}

/**
 * One drawer bank per wall run: convert a single base door unit to a
 * parametric drawer unit. Prefer the unit between the sink and the hob/oven
 * (prep zone), else nearest the sink; never the only unit at a wall end when
 * an interior candidate exists. A second bank goes to the far side of the
 * sink only when the wall has ≥ 6 base cabinets.
 */
function applyDrawerBank(units: PlacedUnit[], wall: Wall): PlacedUnit[] {
  const bases = units.filter(u => u.wallId === wall.id && u.mounted === 'base' && u.kind === 'base')
  if (bases.length === 0) return units
  const sink = units.find(u => u.wallId === wall.id && u.kind === 'sink')
  const oven = units.find(u => u.wallId === wall.id && (u.kind === 'oven' || u.kind === 'hob'))
  const sinkC = sink ? sink.startMm + sink.widthMm / 2 : undefined

  const centre = (u: PlacedUnit) => u.startMm + u.widthMm / 2
  const distToSink = (u: PlacedUnit) => (sinkC === undefined ? 0 : Math.abs(centre(u) - sinkC))

  const pickOne = (candidates: PlacedUnit[], exclude: Set<string>): PlacedUnit | undefined => {
    let pool = candidates.filter(u => !exclude.has(u.instanceId))
    if (sink && oven) {
      const lo = Math.min(sink.startMm + sink.widthMm, oven.startMm + oven.widthMm)
      const hi = Math.max(sink.startMm, oven.startMm)
      const between = pool.filter(u => u.startMm >= lo && u.startMm + u.widthMm <= hi)
      if (between.length > 0) pool = between
    }
    const interior = pool.filter(u => u.startMm > 0 && u.startMm + u.widthMm < wall.lengthMm)
    if (interior.length > 0) pool = interior
    if (pool.length === 0) return undefined
    return pool.reduce((best, u) => (distToSink(u) < distToSink(best) ? u : best))
  }

  const first = pickOne(bases, new Set())
  if (!first) return units
  const chosen = new Set([first.instanceId])

  const baseCabinets = units.filter(u => u.wallId === wall.id && u.mounted === 'base')
  if (baseCabinets.length >= 6 && sink) {
    // second bank on the far side of the sink
    const firstRight = centre(first) > sinkC!
    const farSide = bases.filter(u => !chosen.has(u.instanceId) && (firstRight ? centre(u) < sinkC! : centre(u) > sinkC!))
    const second = pickOne(farSide.length > 0 ? farSide : bases, chosen)
    if (second) chosen.add(second.instanceId)
  }

  return units.map(u =>
    chosen.has(u.instanceId)
      ? { ...u, moduleId: `D${u.widthMm}`, kind: 'drawer' as CabinetKind }
      : u,
  )
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
      // rank combos: exact cover, then 20–80mm leftover (a legal filler),
      // then the smallest leftover to absorb
      combos.sort((a, b) => {
        const leftA = len - a.reduce((x, y) => x + y, 0)
        const leftB = len - b.reduce((x, y) => x + y, 0)
        const rankA = leftA === 0 ? 0 : leftA >= FILLER_MIN_MM && leftA <= FILLER_IDEAL_MAX_MM ? 1 : 2
        const rankB = leftB === 0 ? 0 : leftB >= FILLER_MIN_MM && leftB <= FILLER_IDEAL_MAX_MM ? 1 : 2
        if (rankA !== rankB) return rankA - rankB
        if (a.length !== b.length) return a.length - b.length
        return leftA - leftB
      })
      const top = combos.slice(0, 4)
      const fills: FillResult[] = []

      const sinkCentre = plan.sinkUnit ? plan.sinkUnit.startMm + plan.sinkUnit.widthMm / 2 : undefined

      for (const combo of top) {
        fills.push(placeCombo(span, combo, plan.wall.id, w => ({ moduleId: `B${w}` }), { sinkCentre, wallLenMm: plan.wall.lengthMm }))
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
            const res = placeCombo(ws, chosen, plan.wall.id, w => ({ moduleId: `W${w}` }), { wallLenMm: plan.wall.lengthMm })
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
          const res = placeCombo(ws, chosen, plan.wall.id, w => ({ moduleId: `W${w}` }), { wallLenMm: plan.wall.lengthMm })
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

  // Every combined layout yields two proposal variants: with a per-wall
  // drawer bank, and all doors. Dedupe by signature so identical results
  // collapse (e.g. a wall with no base units).
  const seenVariants = new Set<string>()
  const expanded: { units: PlacedUnit[]; notes: string[] }[] = []
  for (const c of combined) {
    for (const withDrawers of [true, false]) {
      const units = withDrawers
        ? room.walls.reduce((us, w) => applyDrawerBank(us, w), c.units.map(u => ({ ...u })))
        : c.units
      const sig = signature(units)
      if (seenVariants.has(sig)) continue
      seenVariants.add(sig)
      expanded.push({ units, notes: c.notes })
    }
  }

  for (const c of expanded) {
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
