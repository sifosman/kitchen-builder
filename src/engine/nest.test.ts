import { describe, it, expect } from 'vitest'
import { nestBom, type NestPiece } from './nest'
import { buildBom } from './bom'
import { proposeLayouts } from './propose'
import { DOOR_MATERIALS, findDoorMaterial, CARCASS_BOARD } from '../data/boardMaterials'
import type { RoomSpec } from './room'

function defaultRoom(): RoomSpec {
  return {
    shape: 'straight',
    ceilingHeightMm: 2400,
    walls: [
      {
        id: 'A',
        label: 'Wall A',
        lengthMm: 3650,
        obstructions: [
          { id: 'o1', kind: 'fridge', offsetMm: 0, widthMm: 900 },
          { id: 'o2', kind: 'plumbing', offsetMm: 1500, widthMm: 600 },
          { id: 'o3', kind: 'hob', offsetMm: 2600, widthMm: 600 },
        ],
      },
    ],
  }
}

function defaultNest(doorId = 'storm-grey-peen') {
  const top = proposeLayouts(defaultRoom(), 3)[0]
  const bom = buildBom(top.units)
  return nestBom(bom, findDoorMaterial(doorId)!)
}

describe('nestBom', () => {
  it('places every piece of the default kitchen', () => {
    const res = defaultNest()
    expect(res.unplaced).toHaveLength(0)
    expect(res.boards.length).toBeGreaterThan(0)
    expect(res.byMaterial.carcass.boards).toBeGreaterThan(0)
    expect(res.byMaterial.door.boards).toBeGreaterThan(0)
  })

  it('placements never overlap and stay within the sheet', () => {
    const res = defaultNest()
    for (const b of res.boards) {
      for (const p of b.placements) {
        const l = p.rotated ? p.widthMm : p.lengthMm
        const w = p.rotated ? p.lengthMm : p.widthMm
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x + l).toBeLessThanOrEqual(b.sheetLengthMm)
        expect(p.y + w).toBeLessThanOrEqual(b.sheetWidthMm)
      }
      for (let i = 0; i < b.placements.length; i++) {
        for (let j = i + 1; j < b.placements.length; j++) {
          const a = b.placements[i]
          const c = b.placements[j]
          const aL = a.rotated ? a.widthMm : a.lengthMm
          const aW = a.rotated ? a.lengthMm : a.widthMm
          const cL = c.rotated ? c.widthMm : c.lengthMm
          const cW = c.rotated ? c.lengthMm : c.widthMm
          const overlap = a.x < c.x + cL && c.x < a.x + aL && a.y < c.y + cW && c.y < a.y + aW
          expect(overlap, `${a.id} vs ${c.id}`).toBe(false)
        }
      }
    }
  })

  it('never rotates door pieces for woodgrain materials', () => {
    const res = defaultNest('dakota-oak')
    for (const b of res.boards.filter(b => b.material === 'door')) {
      expect(b.placements.every(p => !p.rotated)).toBe(true)
    }
  })

  it('yields are within (0, 100]', () => {
    const res = defaultNest()
    for (const b of res.boards) {
      expect(b.yieldPct).toBeGreaterThan(0)
      expect(b.yieldPct).toBeLessThanOrEqual(100)
    }
  })

  it('oversized pieces land in unplaced instead of throwing', () => {
    const piece: NestPiece = {
      id: 'big',
      cabinetRef: 'test',
      part: 'Side',
      lengthMm: CARCASS_BOARD.sheetLengthMm + 500,
      widthMm: CARCASS_BOARD.sheetWidthMm + 500,
      material: 'carcass',
      edging: '',
      canRotate: true,
    }
    const res = nestBom({ lines: [], edgingMetres: { carcass: 0, door: 0, back: 0 }, hardware: { hinges: 0, runnerPairs: 0, handles: 0, legs: 0, shelfSupportPacks: 0, fixings: 0 }, cabinetCount: 0 }, DOOR_MATERIALS.standard[0])
    expect(res.unplaced).toHaveLength(0)
    // directly nest the oversized piece via a fabricated bom line
    const res2 = nestBom(
      { lines: [{ moduleId: 'X', moduleName: 'X', instanceId: 'A-1', part: 'Side', lengthMm: piece.lengthMm, widthMm: piece.widthMm, qty: 1, edging: '', material: 'carcass' }], edgingMetres: { carcass: 0, door: 0, back: 0 }, hardware: { hinges: 0, runnerPairs: 0, handles: 0, legs: 0, shelfSupportPacks: 0, fixings: 0 }, cabinetCount: 1 },
      DOOR_MATERIALS.standard[0],
    )
    expect(res2.unplaced).toHaveLength(1)
    expect(res2.unplaced[0].part).toBe('Side')
  })
})
