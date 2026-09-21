// Expand a placed layout into a flat bill of materials:
// panels (grouped by carcass/door/back), edging metres, hardware counts.

import { getModule, type PanelMaterial } from '../data/cabinetLibrary'
import type { PlacedUnit } from './rules'

export interface BomLine {
  moduleId: string
  moduleName: string
  instanceId: string
  part: string
  lengthMm: number
  widthMm: number
  qty: number
  edging: string
  material: PanelMaterial
}

export interface HardwareTotals {
  hinges: number
  runnerPairs: number
  handles: number
  legs: number
  shelfSupportPacks: number
  fixings: number
}

export interface Bom {
  lines: BomLine[]
  /** edging metres per material class */
  edgingMetres: Record<PanelMaterial, number>
  hardware: HardwareTotals
  cabinetCount: number
}

function edgingLengthMm(edging: string, lengthMm: number, widthMm: number): number {
  const e = edging.trim()
  if (!e) return 0
  if (e === '1') return 2 * (lengthMm + widthMm)
  let total = 0
  for (const side of e.split(',')) {
    const s = side.trim().toUpperCase()
    if (s === 'L1' || s === 'L2') total += lengthMm
    else if (s === 'W1' || s === 'W2') total += widthMm
  }
  return total
}

export function buildBom(units: PlacedUnit[]): Bom {
  const lines: BomLine[] = []
  const edgingMm: Record<PanelMaterial, number> = { carcass: 0, door: 0, back: 0 }
  const hardware: HardwareTotals = { hinges: 0, runnerPairs: 0, handles: 0, legs: 0, shelfSupportPacks: 0, fixings: 0 }
  let cabinetCount = 0

  for (const u of units) {
    const m = getModule(u.moduleId)
    if (m.kind === 'fridge' || m.kind === 'hob' || m.kind === 'dishwasher') continue // appliance slot
    cabinetCount++
    for (const p of m.panels) {
      // Filler strips are cut to the placed width; other panels use module dims
      const widthMm = m.kind === 'filler' ? u.widthMm : p.widthMm
      lines.push({
        moduleId: u.moduleId,
        moduleName: m.name,
        instanceId: u.instanceId,
        part: p.part,
        lengthMm: p.lengthMm,
        widthMm,
        qty: p.qty,
        edging: p.edging,
        material: p.material,
      })
      edgingMm[p.material] += edgingLengthMm(p.edging, p.lengthMm, widthMm) * p.qty
    }
    hardware.hinges += m.hardware.hinges
    hardware.runnerPairs += m.hardware.runnerPairs
    hardware.handles += m.hardware.handles
    hardware.legs += m.hardware.legs
    hardware.shelfSupportPacks += m.hardware.shelfSupportPacks
    hardware.fixings += m.hardware.fixings
  }

  return {
    lines,
    edgingMetres: {
      carcass: edgingMm.carcass / 1000,
      door: edgingMm.door / 1000,
      back: 0,
    },
    hardware,
    cabinetCount,
  }
}
