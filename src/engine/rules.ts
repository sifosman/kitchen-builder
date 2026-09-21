// Hard rules (never violated) + soft preferences (scoring) from the CEO spec.

import type { CabinetKind } from '../data/cabinetLibrary'
import { getModule } from '../data/cabinetLibrary'
import type { RoomSpec, Wall } from './room'

export interface PlacedUnit {
  /** unique instance id, e.g. 'A-1' */
  instanceId: string
  moduleId: string
  wallId: string
  /** offset from the left end of the wall, mm */
  startMm: number
  widthMm: number
  kind: CabinetKind
  /** wall-mounted units render/hang high */
  mounted: 'base' | 'wall' | 'tall' | 'appliance'
}

export const CORNER_DEAD_BASE_MM = 610   // corner dead-space allowance at counter height
export const CORNER_DEAD_WALL_MM = 330   // shallower allowance for wall units
export const FRIDGE_VENT_MM = 50         // ventilation gap each side of fridge
export const FILLER_MIN_MM = 20
export const FILLER_IDEAL_MAX_MM = 80
export const FILLER_MAX_MM = 150
export const WALL_UNIT_BOTTOM_MM = 1450
export const WALL_UNIT_TOP_MM = 2170
export const HOB_TALL_CLEARANCE_MM = 150 // hob must not sit against a tall unit

export function unitsOverlap(a: PlacedUnit, b: PlacedUnit): boolean {
  if (a.wallId !== b.wallId) return false
  // the only pairing that can't collide: a wall unit hanging over a base unit.
  // wall-vs-tall, wall-vs-appliance, wall-vs-wall all share the 1450+ band.
  const pair = [a.mounted, b.mounted].sort().join('+')
  if (pair === 'base+wall') return false
  return a.startMm < b.startMm + b.widthMm && b.startMm < a.startMm + a.widthMm
}

function rangeOverlap(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && bS < aE
}

/**
 * Hard-rule validation. Returns a list of violations (empty = valid).
 */
export function validateLayout(units: PlacedUnit[], room: RoomSpec): string[] {
  const violations: string[] = []
  const walls = new Map(room.walls.map(w => [w.id, w]))

  for (const u of units) {
    const wall = walls.get(u.wallId)
    if (!wall) {
      violations.push(`${u.instanceId}: unknown wall ${u.wallId}`)
      continue
    }
    const uEnd = u.startMm + u.widthMm
    if (u.startMm < 0 || uEnd > wall.lengthMm) {
      violations.push(`${u.instanceId} (${u.moduleId}): outside wall ${u.wallId} bounds`)
    }

    for (const o of wall.obstructions) {
      const oS = o.offsetMm
      const oE = o.offsetMm + o.widthMm
      const overlaps = rangeOverlap(u.startMm, uEnd, oS, oE)
      if (!overlaps) continue
      switch (o.kind) {
        case 'door':
        case 'block':
          violations.push(`${u.instanceId} (${u.moduleId}): overlaps ${o.kind} on wall ${u.wallId}`)
          break
        case 'window': {
          const sill = o.sillHeightMm ?? 900
          const top = sill + (o.heightMm ?? 1200)
          if (u.mounted === 'wall' && top > WALL_UNIT_BOTTOM_MM) {
            violations.push(`${u.instanceId} (${u.moduleId}): wall unit over window on wall ${u.wallId}`)
          }
          if (u.mounted === 'base' && sill < 870) {
            violations.push(`${u.instanceId} (${u.moduleId}): base unit under low window on wall ${u.wallId}`)
          }
          break
        }
        case 'plumbing':
          // only the sink unit may occupy the plumbing zone at counter level
          if (u.kind !== 'sink' && u.mounted !== 'wall') {
            violations.push(`${u.instanceId} (${u.moduleId}): non-sink unit over plumbing on wall ${u.wallId}`)
          }
          break
        case 'hob':
          if (u.kind !== 'hob' && u.kind !== 'oven') {
            violations.push(`${u.instanceId} (${u.moduleId}): unit over hob zone on wall ${u.wallId}`)
          }
          if (u.mounted === 'wall') {
            violations.push(`${u.instanceId} (${u.moduleId}): wall unit over hob — extractor zone on wall ${u.wallId}`)
          }
          break
        case 'fridge':
          if (u.kind !== 'fridge') {
            violations.push(`${u.instanceId} (${u.moduleId}): unit inside fridge zone on wall ${u.wallId}`)
          }
          break
        case 'dishwasher':
          if (u.kind !== 'dishwasher') {
            violations.push(`${u.instanceId} (${u.moduleId}): unit inside dishwasher zone on wall ${u.wallId}`)
          }
          break
      }
    }
  }

  // pairwise overlaps
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      if (unitsOverlap(units[i], units[j])) {
        violations.push(`${units[i].instanceId} overlaps ${units[j].instanceId} on wall ${units[i].wallId}`)
      }
    }
  }

  // fillers may only sit against a hard boundary (wall end, fridge, tall
  // unit, door/block) — a filler between two cabinets/appliances is mid-run
  for (const f of units.filter(u => u.kind === 'filler')) {
    const band = (u: PlacedUnit) => (u.mounted === 'wall' ? 'wall' : 'floor')
    const row = units.filter(u => u !== f && u.wallId === f.wallId && band(u) === band(f))
    const left = row.find(u => u.startMm + u.widthMm === f.startMm)
    const right = row.find(u => u.startMm === f.startMm + f.widthMm)
    const hard = (u?: PlacedUnit) => !!u && (u.kind === 'fridge' || u.kind === 'tall')
    if (left && right && !hard(left) && !hard(right)) {
      violations.push(`${f.instanceId} (${f.moduleId}): filler mid-run on wall ${f.wallId}`)
    }
  }

  // hob must not sit directly against a tall unit
  for (const hob of units.filter(u => u.kind === 'hob')) {
    for (const tall of units.filter(u => u.kind === 'tall' && u.wallId === hob.wallId)) {
      const gap = Math.max(tall.startMm - (hob.startMm + hob.widthMm), hob.startMm - (tall.startMm + tall.widthMm))
      if (gap < HOB_TALL_CLEARANCE_MM) {
        violations.push(`${hob.instanceId} (hob): within ${HOB_TALL_CLEARANCE_MM}mm of tall unit ${tall.instanceId}`)
      }
    }
  }

  // corner dead zone: secondary walls cede the first 610mm (floor) /
  // 330mm (wall units) so the neighbouring wall's run fits the corner
  room.walls.forEach((wall, wi) => {
    if (wi === 0) return
    const deadBase = Math.min(CORNER_DEAD_BASE_MM, wall.lengthMm)
    const deadWall = Math.min(CORNER_DEAD_WALL_MM, wall.lengthMm)
    for (const u of units.filter(u => u.wallId === wall.id)) {
      const limit = u.mounted === 'wall' ? deadWall : deadBase
      if (u.startMm < limit) {
        violations.push(`${u.instanceId} (${u.moduleId}): inside corner dead zone on wall ${wall.id}`)
      }
    }
  })

  // sink must be centred (±150mm) on the plumbing obstruction
  for (const wall of room.walls) {
    const plumbing = wall.obstructions.filter(o => o.kind === 'plumbing')
    if (plumbing.length === 0) continue
    const sinks = units.filter(u => u.kind === 'sink' && u.wallId === wall.id)
    if (sinks.length === 0) {
      violations.push(`wall ${wall.id}: plumbing marked but no sink unit placed`)
      continue
    }
    for (const p of plumbing) {
      const centre = p.offsetMm + p.widthMm / 2
      const covered = sinks.some(s => {
        const sCentre = s.startMm + s.widthMm / 2
        return Math.abs(sCentre - centre) <= 150
      })
      if (!covered) violations.push(`wall ${wall.id}: sink not centred on plumbing at ${Math.round(centre)}mm`)
    }
  }

  return violations
}

/**
 * Soft-preference scoring — higher is better.
 *  fewer cabinets > more; 600/900 widths > 300/450; fillers 20–80mm;
 *  drawers near the sink/prep zone; dishwasher beside sink; wall-unit symmetry.
 */
export function scoreLayout(units: PlacedUnit[], room: RoomSpec): number {
  let score = 0
  const cabinets = units.filter(u => !['fridge', 'hob', 'dishwasher', 'filler'].includes(u.kind))
  score -= cabinets.length * 10 // fewer cabinets preferred

  for (const u of units) {
    if (u.kind === 'filler') {
      if (u.widthMm >= FILLER_MIN_MM && u.widthMm <= FILLER_IDEAL_MAX_MM) score += 12
      else if (u.widthMm <= FILLER_MAX_MM) score += 4
      else score -= 15
      continue
    }
    if (u.widthMm === 600 || u.widthMm === 900) score += 8
    if (u.widthMm === 450) score += 3
    if (u.widthMm === 300) score += 1
  }

  // dishwasher adjacent to sink
  for (const dw of units.filter(u => u.kind === 'dishwasher')) {
    const sink = units.find(u => u.kind === 'sink' && u.wallId === dw.wallId)
    if (sink) {
      const adjacent =
        Math.abs(dw.startMm - (sink.startMm + sink.widthMm)) < 5 ||
        Math.abs(sink.startMm - (dw.startMm + dw.widthMm)) < 5
      if (adjacent) score += 20
    }
  }

  // drawers near the sink (prep zone)
  const sink = units.find(u => u.kind === 'sink')
  if (sink) {
    for (const d of units.filter(u => u.kind === 'drawer' && u.wallId === sink.wallId)) {
      const gap = Math.max(0, d.startMm - (sink.startMm + sink.widthMm), sink.startMm - (d.startMm + d.widthMm))
      if (gap < 600) score += 15
      else if (gap < 1200) score += 6
    }
  }

  // wall-unit symmetry: same-width wall units grouped evenly
  const wallUnits = units.filter(u => u.mounted === 'wall')
  const widths = wallUnits.map(u => u.widthMm).sort()
  if (wallUnits.length >= 2 && widths.every(w => w === widths[0])) score += 8

  // extractor handled implicitly (hob zone blocks wall units)
  void room
  return Math.round(score)
}
