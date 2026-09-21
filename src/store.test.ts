// Edits must never push a cabinet over an appliance or into a blocked zone.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { unitsOverlap } from './engine/rules'

beforeEach(() => {
  useStore.getState().resetDesign()
  useStore.getState().generate()
})

describe('manual edit clamping', () => {
  it('nudging a cabinet towards the fridge stops at the fridge, not inside it', () => {
    const s = useStore.getState()
    const fridge = s.units.find(u => u.kind === 'fridge')!
    const rightOfFridge = s.units
      .filter(u => u.wallId === fridge.wallId && u.mounted !== 'wall' && u.startMm >= fridge.startMm + fridge.widthMm)
      .sort((a, b) => a.startMm - b.startMm)[0]
    // hammer it left — should clamp at the fridge edge
    for (let i = 0; i < 30; i++) useStore.getState().nudgeUnit(rightOfFridge.instanceId, -100)
    const moved = useStore.getState().units.find(u => u.instanceId === rightOfFridge.instanceId)!
    const fr = useStore.getState().units.find(u => u.instanceId === fridge.instanceId)!
    expect(unitsOverlap(moved, fr)).toBe(false)
    expect(moved.startMm).toBeGreaterThanOrEqual(fr.startMm + fr.widthMm)
  })

  it('widening a cabinet clamps at the next unit instead of covering it', () => {
    const s = useStore.getState()
    const bases = s.units.filter(u => u.mounted === 'base').sort((a, b) => a.startMm - b.startMm)
    const [a, b] = bases
    useStore.getState().setUnitWidth(a.instanceId, 1000)
    const after = useStore.getState().units.find(u => u.instanceId === a.instanceId)!
    expect(after.startMm + after.widthMm).toBeLessThanOrEqual(b.startMm)
  })

  it('a wall unit can never be added or nudged over the fridge', () => {
    const s = useStore.getState()
    const fridge = s.units.find(u => u.kind === 'fridge')!
    // try to add a wall unit — first free wall-band slot must be clear of the fridge zone
    useStore.getState().addUnit('W600', 'A')
    const added = useStore.getState().units.find(u => u.mounted === 'wall' && u.instanceId.includes('M'))
    if (added) {
      expect(added.startMm >= fridge.startMm + fridge.widthMm || added.startMm + added.widthMm <= fridge.startMm).toBe(true)
    }
    // and nudging any wall unit left can't slide it over the fridge
    const w = useStore.getState().units.find(u => u.mounted === 'wall' && u.wallId === 'A')!
    for (let i = 0; i < 30; i++) useStore.getState().nudgeUnit(w.instanceId, -100)
    const moved = useStore.getState().units.find(u => u.instanceId === w.instanceId)!
    expect(moved.startMm >= fridge.startMm + fridge.widthMm || moved.startMm + moved.widthMm <= fridge.startMm).toBe(true)
  })

  it('a base cabinet can never slide onto the hob zone', () => {
    const s = useStore.getState()
    const oven = s.units.find(u => u.kind === 'oven')!
    const bases = s.units.filter(u => u.mounted === 'base' && u.kind === 'base')
    for (const b of bases) {
      for (let i = 0; i < 40; i++) useStore.getState().nudgeUnit(b.instanceId, 100)
      for (let i = 0; i < 40; i++) useStore.getState().nudgeUnit(b.instanceId, -100)
      const moved = useStore.getState().units.find(u => u.instanceId === b.instanceId)!
      expect(moved.startMm >= oven.startMm + oven.widthMm || moved.startMm + moved.widthMm <= oven.startMm).toBe(true)
    }
  })

  it('a tall unit can never be added under a wall unit', () => {
    // default layout already has wall units; a T600 must land in a clear stretch
    useStore.getState().addUnit('T600', 'A')
    const tall = useStore.getState().units.find(u => u.kind === 'tall')
    if (tall) {
      for (const w of useStore.getState().units.filter(u => u.mounted === 'wall' && u.wallId === 'A')) {
        expect(tall.startMm >= w.startMm + w.widthMm || tall.startMm + tall.widthMm <= w.startMm).toBe(true)
      }
    }
    // and nudging a tall unit can't slide it under the wall run either
    if (tall) {
      for (let i = 0; i < 40; i++) useStore.getState().nudgeUnit(tall.instanceId, 100)
      for (let i = 0; i < 40; i++) useStore.getState().nudgeUnit(tall.instanceId, -100)
      const moved = useStore.getState().units.find(u => u.instanceId === tall.instanceId)!
      for (const w of useStore.getState().units.filter(u => u.mounted === 'wall' && u.wallId === 'A')) {
        expect(moved.startMm >= w.startMm + w.widthMm || moved.startMm + moved.widthMm <= w.startMm).toBe(true)
      }
    }
  })

  it('addUnit never lands inside a door zone', () => {
    useStore.getState().resetDesign()
    useStore.getState().setRoom({
      shape: 'straight', ceilingHeightMm: 2400,
      walls: [{ id: 'A', label: 'A', lengthMm: 4000, obstructions: [{ id: 'door1', kind: 'door' as const, offsetMm: 1000, widthMm: 820 }] }],
    })
    useStore.getState().generate()
    // fill until addUnit refuses, then check nothing sits inside the door zone
    for (let i = 0; i < 8; i++) useStore.getState().addUnit('B300', 'A')
    for (const u of useStore.getState().units) {
      expect(u.startMm >= 1820 || u.startMm + u.widthMm <= 1000).toBe(true)
    }
  })
})
