import { describe, it, expect } from 'vitest'
import { proposeLayouts } from './engine/propose'
import { validateLayout, unitsOverlap, CORNER_DEAD_BASE_MM, CORNER_DEAD_WALL_MM } from './engine/rules'
import type { RoomSpec, Obstruction, ObstructionKind } from './engine/room'

let seed = 42
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
const KINDS: ObstructionKind[] = ['fridge', 'hob', 'plumbing', 'dishwasher', 'window', 'door', 'block']
const WIDTHS: Record<string, number> = { fridge: 900, hob: 600, plumbing: 600, dishwasher: 600, window: 1200, door: 820, block: 300 }

describe('fuzz', () => {
  for (let c = 0; c < 60; c++) {
    it(`fuzz ${c}`, () => {
      const shape = (['straight', 'l-shape', 'u-shape'] as const)[Math.floor(rnd() * 3)]
      const nWalls = shape === 'straight' ? 1 : shape === 'l-shape' ? 2 : 3
      const walls = Array.from({ length: nWalls }, (_, wi) => {
        const len = 2000 + Math.floor(rnd() * 3000)
        const nObs = Math.floor(rnd() * 4)
        const obstructions: Obstruction[] = []
        for (let i = 0; i < nObs; i++) {
          const kind = KINDS[Math.floor(rnd() * KINDS.length)]
          obstructions.push({
            id: `o${c}-${wi}-${i}`, kind,
            offsetMm: Math.floor(rnd() * len),
            widthMm: WIDTHS[kind],
            ...(kind === 'window' ? { sillHeightMm: 900, heightMm: 1200 } : {}),
          })
        }
        return { id: String.fromCharCode(65 + wi), label: String.fromCharCode(65 + wi), lengthMm: len, obstructions }
      })
      const room: RoomSpec = { shape, ceilingHeightMm: 2400, walls }
      const proposals = proposeLayouts(room, 2)
      for (const p of proposals) {
        const violations = validateLayout(p.units, room)
        // overlaps may only survive when the input is genuinely impossible —
        // and then they must be flagged, never silent
        for (let i = 0; i < p.units.length; i++)
          for (let j = i + 1; j < p.units.length; j++)
            if (unitsOverlap(p.units[i], p.units[j])) {
              expect(violations.length, `fuzz ${c} ${p.id}: silent overlap ${p.units[i].moduleId}@${p.units[i].startMm} vs ${p.units[j].moduleId}@${p.units[j].startMm} wall ${p.units[i].wallId}`).toBeGreaterThan(0)
            }
        // nothing in a secondary wall's dead zone
        room.walls.forEach((w, wi) => {
          if (wi === 0) return
          for (const u of p.units.filter(u => u.wallId === w.id)) {
            const lim = u.mounted === 'wall' ? CORNER_DEAD_WALL_MM : CORNER_DEAD_BASE_MM
            expect(u.startMm >= lim, `fuzz ${c} ${p.id}: ${u.moduleId}@${u.startMm} in dead zone wall ${w.id}`).toBe(true)
          }
        })
      }
    })
  }
})
