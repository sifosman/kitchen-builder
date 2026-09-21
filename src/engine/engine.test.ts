import { describe, it, expect } from 'vitest'
import { proposeLayouts } from './propose'
import { validateLayout } from './rules'
import { buildBom } from './bom'
import { priceKitchen, panelAreaMm2 } from './pricing'
import { freeSpans, type RoomSpec } from './room'
import { getModule } from '../data/cabinetLibrary'
import { DOOR_MATERIALS } from '../data/boardMaterials'

function room(overrides: Partial<RoomSpec> = {}): RoomSpec {
  return {
    shape: 'straight',
    ceilingHeightMm: 2400,
    walls: [{ id: 'A', label: 'Wall A', lengthMm: 3650, obstructions: [] }],
    ...overrides,
  }
}

describe('freeSpans', () => {
  it('blocks the full span for a door', () => {
    const wall = { id: 'A', label: 'A', lengthMm: 3000, obstructions: [{ id: 'd', kind: 'door' as const, offsetMm: 1000, widthMm: 820 }] }
    const spans = freeSpans(wall)
    expect(spans).toEqual([
      { startMm: 0, endMm: 1000 },
      { startMm: 1820, endMm: 3000 },
    ])
  })

  it('window at sill 900 blocks wall units but not base units', () => {
    const wall = { id: 'A', label: 'A', lengthMm: 3000, obstructions: [{ id: 'w', kind: 'window' as const, offsetMm: 500, widthMm: 1200, sillHeightMm: 900, heightMm: 1200 }] }
    expect(freeSpans(wall, false)).toEqual([{ startMm: 0, endMm: 3000 }])
    expect(freeSpans(wall, true)).toEqual([
      { startMm: 0, endMm: 500 },
      { startMm: 1700, endMm: 3000 },
    ])
  })
})

describe('proposeLayouts', () => {
  it('fills the CEO worked-example wall: 3650 − 900 fridge → valid fill of ~2700', () => {
    const r = room()
    r.walls[0].obstructions = [{ id: 'f', kind: 'fridge', offsetMm: 0, widthMm: 900 }]
    const proposals = proposeLayouts(r, 3)
    expect(proposals.length).toBeGreaterThan(0)
    const top = proposals[0]
    expect(top.violations).toEqual([])
    const base = top.units.filter(u => u.mounted === 'base')
    const covered = base.reduce((s, u) => s + u.widthMm, 0)
    // span = 3650 − (900 fridge + 50 vent) = 2700; cabinets+filler cover ≥2550
    expect(covered).toBeGreaterThanOrEqual(2550)
    // fridge placed
    expect(top.units.some(u => u.kind === 'fridge')).toBe(true)
  })

  it('centres the sink on the plumbing point', () => {
    const r = room()
    r.walls[0].obstructions = [{ id: 'p', kind: 'plumbing', offsetMm: 1500, widthMm: 600 }]
    const proposals = proposeLayouts(r, 3)
    const top = proposals[0]
    const sink = top.units.find(u => u.kind === 'sink')
    expect(sink).toBeTruthy()
    expect(Math.abs(sink!.startMm + sink!.widthMm / 2 - 1800)).toBeLessThanOrEqual(150)
    expect(top.violations).toEqual([])
  })

  it('never places a wall unit over the hob (extractor zone)', () => {
    const r = room()
    r.walls[0].obstructions = [{ id: 'h', kind: 'hob', offsetMm: 2000, widthMm: 600 }]
    const top = proposeLayouts(r, 3)[0]
    const over = top.units.filter(u => u.mounted === 'wall' && u.wallId === 'A' && u.startMm < 2650 && u.startMm + u.widthMm > 1950)
    expect(over).toEqual([])
    expect(top.units.some(u => u.kind === 'oven')).toBe(true)
  })

  it('L-shape: secondary wall loses corner dead space', () => {
    const r: RoomSpec = {
      shape: 'l-shape',
      ceilingHeightMm: 2400,
      walls: [
        { id: 'A', label: 'A', lengthMm: 3000, obstructions: [] },
        { id: 'B', label: 'B', lengthMm: 2400, obstructions: [] },
      ],
    }
    const top = proposeLayouts(r, 3)[0]
    expect(top.violations).toEqual([])
    // nothing on wall B may start before the 610mm dead zone
    const bBase = top.units.filter(u => u.wallId === 'B' && u.mounted === 'base')
    expect(bBase.every(u => u.startMm >= 600)).toBe(true)
  })
})

describe('validateLayout', () => {
  it('flags a non-sink unit over plumbing', () => {
    const r = room()
    r.walls[0].obstructions = [{ id: 'p', kind: 'plumbing', offsetMm: 1500, widthMm: 600 }]
    const bad = [{
      instanceId: 'A-1', moduleId: 'B600', wallId: 'A', startMm: 1500, widthMm: 600,
      kind: 'base' as const, mounted: 'base' as const,
    }]
    const v = validateLayout(bad, r)
    expect(v.some(x => x.includes('non-sink'))).toBe(true)
  })

  it('flags a hob directly against a tall unit', () => {
    const r = room()
    const units = [
      { instanceId: 'A-1', moduleId: 'OVEN600', wallId: 'A', startMm: 1000, widthMm: 600, kind: 'hob' as const, mounted: 'base' as const },
      { instanceId: 'A-2', moduleId: 'T600', wallId: 'A', startMm: 1600, widthMm: 600, kind: 'tall' as const, mounted: 'tall' as const },
    ]
    const v = validateLayout(units, r)
    expect(v.some(x => x.includes('tall unit'))).toBe(true)
  })

  it('flags unit overlap', () => {
    const r = room()
    const units = [
      { instanceId: 'A-1', moduleId: 'B600', wallId: 'A', startMm: 0, widthMm: 600, kind: 'base' as const, mounted: 'base' as const },
      { instanceId: 'A-2', moduleId: 'B600', wallId: 'A', startMm: 500, widthMm: 600, kind: 'base' as const, mounted: 'base' as const },
    ]
    expect(validateLayout(units, r).some(x => x.includes('overlaps'))).toBe(true)
  })
})

describe('buildBom', () => {
  it('B600 produces the standard carcass+door panel set', () => {
    const units = [{ instanceId: 'A-1', moduleId: 'B600', wallId: 'A', startMm: 0, widthMm: 600, kind: 'base' as const, mounted: 'base' as const }]
    const bom = buildBom(units)
    const parts = bom.lines.map(l => l.part)
    expect(parts.filter(p => p === 'Side')).toHaveLength(1) // qty 2 on one line
    expect(parts).toContain('Bottom')
    expect(parts).toContain('Back')
    expect(parts).toContain('Shelf')
    expect(parts).toContain('Door')
    expect(bom.hardware.hinges).toBe(2)
    expect(bom.hardware.handles).toBe(1)
    expect(bom.hardware.legs).toBe(4)
    expect(bom.cabinetCount).toBe(1)
    // door gets all-4-sides edging
    const door = bom.lines.find(l => l.material === 'door')!
    expect(door.edging).toBe('1')
  })

  it('appliance slots produce no panels', () => {
    const units = [{ instanceId: 'A-1', moduleId: 'FRIDGE900', wallId: 'A', startMm: 0, widthMm: 900, kind: 'fridge' as const, mounted: 'appliance' as const }]
    const bom = buildBom(units)
    expect(bom.lines).toHaveLength(0)
    expect(bom.cabinetCount).toBe(0)
  })
})

describe('priceKitchen', () => {
  it('prices a single B600 sensibly in each tier', () => {
    const units = [{ instanceId: 'A-1', moduleId: 'B600', wallId: 'A', startMm: 0, widthMm: 600, kind: 'base' as const, mounted: 'base' as const }]
    const bom = buildBom(units)
    expect(panelAreaMm2(bom, 'carcass')).toBeGreaterThan(0)
    const value = priceKitchen(bom, DOOR_MATERIALS.value[0], 'value')
    const premium = priceKitchen(bom, DOOR_MATERIALS.premium[0], 'premium')
    // one carcass + one door sheet minimum
    expect(value.carcassSheets).toBe(1)
    expect(value.doorSheets).toBe(1)
    // premium > value (gloss door board + undermount runners + better handles)
    expect(premium.total).toBeGreaterThan(value.total)
    // sanity: a single base unit lands in a plausible range
    expect(value.total).toBeGreaterThan(1500)
    expect(value.total).toBeLessThan(6000)
  })

  it('library sanity: every module has positive dims and panels (non-appliance)', () => {
    for (const id of ['B300', 'B450', 'B600', 'B900', 'W600', 'T600', 'D600', 'SINK900', 'OVEN600', 'F50']) {
      const m = getModule(id)
      expect(m.widthMm).toBeGreaterThan(0)
      expect(m.panels.length).toBeGreaterThan(0)
    }
  })
})
