// Regression: fixed appliances on secondary walls must stay clear of the
// corner dead zone, and contradictory obstruction input must be flagged
// rather than silently producing overlapping cabinets.
import { describe, it, expect } from 'vitest'
import { proposeLayouts } from './propose'
import { validateLayout, CORNER_DEAD_BASE_MM, unitsOverlap } from './rules'
import type { RoomSpec, Obstruction } from './room'

let oid = 0
const ob = (o: Partial<Obstruction> & { kind: Obstruction['kind'] }): Obstruction =>
  ({ id: `o${++oid}`, offsetMm: 0, widthMm: 600, ...o })

describe('corner dead zone on secondary walls', () => {
  const lRoom = (bObs: Obstruction[]): RoomSpec => ({
    shape: 'l-shape',
    ceilingHeightMm: 2400,
    walls: [
      { id: 'A', label: 'A', lengthMm: 3650, obstructions: [ob({ kind: 'fridge', offsetMm: 0, widthMm: 900 }), ob({ kind: 'plumbing', offsetMm: 1500 }), ob({ kind: 'hob', offsetMm: 2600 })] },
      { id: 'B', label: 'B', lengthMm: 2400, obstructions: bObs },
    ],
  })

  it('fridge at the corner is pushed out of the dead zone', () => {
    const ps = proposeLayouts(lRoom([ob({ kind: 'fridge', offsetMm: 200, widthMm: 900 })]), 3)
    const top = ps[0]
    expect(top.violations).toEqual([])
    const fridges = top.units.filter(u => u.wallId === 'B' && u.kind === 'fridge')
    expect(fridges).toHaveLength(1)
    expect(fridges[0].startMm).toBeGreaterThanOrEqual(CORNER_DEAD_BASE_MM)
    // nothing on wall B sits inside the dead zone
    for (const u of top.units.filter(u => u.wallId === 'B' && u.mounted !== 'wall')) {
      expect(u.startMm).toBeGreaterThanOrEqual(CORNER_DEAD_BASE_MM)
    }
  })

  it('hob near the corner keeps the oven unit clear', () => {
    const ps = proposeLayouts(lRoom([ob({ kind: 'hob', offsetMm: 300, widthMm: 600 })]), 3)
    const top = ps[0]
    expect(top.violations).toEqual([])
    const oven = top.units.find(u => u.wallId === 'B' && u.kind === 'oven')
    expect(oven!.startMm).toBeGreaterThanOrEqual(CORNER_DEAD_BASE_MM)
  })

  it('no pair of units anywhere overlaps', () => {
    const ps = proposeLayouts(lRoom([ob({ kind: 'fridge', offsetMm: 200, widthMm: 900 }), ob({ kind: 'hob', offsetMm: 1500, widthMm: 600 })]), 3)
    for (const p of ps) {
      for (let i = 0; i < p.units.length; i++)
        for (let j = i + 1; j < p.units.length; j++)
          expect(unitsOverlap(p.units[i], p.units[j])).toBe(false)
    }
  })
})

describe('contradictory obstruction input', () => {
  it('plumbing inside the fridge zone is flagged, not silently overlapped', () => {
    const r: RoomSpec = {
      shape: 'straight', ceilingHeightMm: 2400,
      walls: [{ id: 'A', label: 'A', lengthMm: 3650, obstructions: [ob({ kind: 'fridge', offsetMm: 0, widthMm: 900 }), ob({ kind: 'plumbing', offsetMm: 700, widthMm: 600 }), ob({ kind: 'hob', offsetMm: 2600 })] }],
    }
    const top = proposeLayouts(r, 1)[0]
    // the sink is pushed out of the fridge's footprint — either way the
    // contradiction must surface as a violation, not silent overlap
    expect(top.violations.length).toBeGreaterThan(0)
    const sink = top.units.find(u => u.kind === 'sink')!
    const fridge = top.units.find(u => u.kind === 'fridge')!
    expect(unitsOverlap(sink, fridge)).toBe(false)
  })
})
