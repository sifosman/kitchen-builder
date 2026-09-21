// Pricing engine: BOM → cost estimate across the three tiers.
// All figures are VAT-inclusive Rand, seeded from the William price list.
// This is an estimate — the authoritative quote comes from the optimizer API.

import type { BoardMaterial } from '../data/boardMaterials'
import { CARCASS_BOARD } from '../data/boardMaterials'
import { FIXINGS_ALLOWANCE, SHELF_SUPPORT, TIER_HARDWARE } from '../data/hardware'
import type { Bom } from './bom'

export type Tier = 'value' | 'standard' | 'premium'

export interface TierConfig {
  tier: Tier
  label: string
  doorMaterial: BoardMaterial
}

export interface PriceBreakdown {
  tier: Tier
  carcassSheets: number
  doorSheets: number
  backerSheets: number
  carcassCost: number
  doorCost: number
  backerCost: number
  edgingCost: number
  hardwareCost: number
  cuttingCost: number
  labourCost: number
  total: number
}

/** Wastage factor applied when estimating sheet counts from panel area. */
export const WASTE_FACTOR = 1.18
export const CUTTING_FEE_PER_SHEET = 65        // william CUT96
export const CARCASS_EDGING_RATE = 7.75        // 0.4mm PVC /m
export const DOOR_EDGING_RATE = 15             // 1.0mm PVC /m
export const BACKER_PRICE_PER_SHEET = 265      // 3mm MDF/hardboard backing
export const BACKER_SHEET_AREA_MM2 = 2750 * 1830

/** Assembly/fit labour per module kind (V1 seeds — refine against branch rates). */
export const LABOUR_PER_KIND: Record<string, number> = {
  base: 550,
  drawer: 750,
  sink: 500,
  oven: 450,
  wall: 450,
  tall: 950,
  filler: 80,
}

export function panelAreaMm2(bom: Bom, material: 'carcass' | 'door' | 'back'): number {
  return bom.lines
    .filter(l => l.material === material)
    .reduce((sum, l) => sum + l.lengthMm * l.widthMm * l.qty, 0)
}

export function sheetsNeeded(areaMm2: number, sheet: BoardMaterial): number {
  const sheetArea = sheet.sheetLengthMm * sheet.sheetWidthMm
  return Math.max(1, Math.ceil((areaMm2 * WASTE_FACTOR) / sheetArea))
}

export function priceKitchen(bom: Bom, doorMaterial: BoardMaterial, tier: Tier): PriceBreakdown {
  const carcassArea = panelAreaMm2(bom, 'carcass')
  const doorArea = panelAreaMm2(bom, 'door')
  const backArea = panelAreaMm2(bom, 'back')

  const carcassSheets = sheetsNeeded(carcassArea, CARCASS_BOARD)
  const doorSheets = sheetsNeeded(doorArea, doorMaterial)
  const backerSheets = Math.max(1, Math.ceil((backArea * 1.1) / BACKER_SHEET_AREA_MM2))

  const hw = TIER_HARDWARE[tier]
  const hardwareCost =
    bom.hardware.hinges * hw.hinge.unitPrice +
    bom.hardware.runnerPairs * hw.runner.unitPrice +
    bom.hardware.handles * hw.handle.unitPrice +
    bom.hardware.legs * hw.leg.unitPrice +
    bom.hardware.shelfSupportPacks * SHELF_SUPPORT.unitPrice +
    bom.hardware.fixings * FIXINGS_ALLOWANCE.unitPrice

  const edgingCost =
    bom.edgingMetres.carcass * CARCASS_EDGING_RATE +
    bom.edgingMetres.door * DOOR_EDGING_RATE

  const cuttingCost = (carcassSheets + doorSheets) * CUTTING_FEE_PER_SHEET

  let labourCost = 0
  for (const line of bom.lines) {
    void line
  }
  // labour is per cabinet, not per panel — count distinct modules by kind
  const seen = new Map<string, string>()
  for (const l of bom.lines) {
    if (!seen.has(l.instanceId)) seen.set(l.instanceId, l.moduleId)
  }
  for (const moduleId of seen.values()) {
    const kind = moduleId.startsWith('D') ? 'drawer'
      : moduleId.startsWith('W') ? 'wall'
      : moduleId.startsWith('T') ? 'tall'
      : moduleId.startsWith('SINK') ? 'sink'
      : moduleId.startsWith('OVEN') ? 'oven'
      : moduleId.startsWith('F') ? 'filler'
      : 'base'
    labourCost += LABOUR_PER_KIND[kind] ?? 550
  }

  const carcassCost = carcassSheets * CARCASS_BOARD.pricePerSheet
  const doorCost = doorSheets * doorMaterial.pricePerSheet
  const backerCost = backerSheets * BACKER_PRICE_PER_SHEET

  const total = carcassCost + doorCost + backerCost + edgingCost + hardwareCost + cuttingCost + labourCost

  return {
    tier,
    carcassSheets,
    doorSheets,
    backerSheets,
    carcassCost: Math.round(carcassCost),
    doorCost: Math.round(doorCost),
    backerCost: Math.round(backerCost),
    edgingCost: Math.round(edgingCost),
    hardwareCost: Math.round(hardwareCost),
    cuttingCost: Math.round(cuttingCost),
    labourCost: Math.round(labourCost),
    total: Math.round(total),
  }
}

/** Price all three tiers using the default door material for each. */
export function priceAllTiers(
  bom: Bom,
  doorMaterials: Record<Tier, BoardMaterial>,
): Record<Tier, PriceBreakdown> {
  return {
    value: priceKitchen(bom, doorMaterials.value, 'value'),
    standard: priceKitchen(bom, doorMaterials.standard, 'standard'),
    premium: priceKitchen(bom, doorMaterials.premium, 'premium'),
  }
}
