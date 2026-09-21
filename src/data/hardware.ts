// Hardware pricing seeded from the William price list (R incl VAT).
// Three hardware levels map to the Value / Standard / Premium quote tiers.

export interface HardwareItem {
  id: string
  name: string
  /** Exact hds_prices_william description when the item is quotable via API */
  apiDescription?: string
  unitPrice: number
  unit: 'each' | 'pair' | 'metre' | 'pack'
}

export interface TierHardware {
  hinge: HardwareItem
  runner: HardwareItem
  handle: HardwareItem
  leg: HardwareItem
}

export const HINGES: Record<'basic' | 'softClose', HardwareItem> = {
  basic: {
    id: 'hinge-basic',
    name: 'Standard hinge + plate',
    apiDescription: 'HINGE Inset 15mm 4 Hole with Plate',
    unitPrice: 4.4,
    unit: 'each',
  },
  softClose: {
    id: 'hinge-soft-close',
    name: 'Titan soft-close hinge',
    apiDescription: 'HINGE Titan Soft Close Full Overlay 4 Hole Clip On',
    unitPrice: 11,
    unit: 'each',
  },
}

export const RUNNERS: Record<'basic' | 'softClose' | 'underMount', HardwareItem> = {
  basic: {
    id: 'runner-basic',
    name: 'Ball-bearing runner 450mm',
    apiDescription: 'RUNNER TITAN Ball Bearing Full Ext 35 x 450mm',
    unitPrice: 25,
    unit: 'pair',
  },
  softClose: {
    id: 'runner-soft-close',
    name: 'Soft-close runner 500mm',
    apiDescription: 'RUNNER Titan Ball Bearing Soft Close 45 x 500mm',
    unitPrice: 79,
    unit: 'pair',
  },
  underMount: {
    id: 'runner-under-mount',
    name: 'Under-mount soft-close runner 500mm',
    apiDescription: 'RUNNER Titan Under Mount Soft Close 500mm',
    unitPrice: 159,
    unit: 'pair',
  },
}

export const HANDLES: Record<'basic' | 'brushed' | 'premium', HardwareItem> = {
  basic: {
    id: 'handle-basic',
    name: 'Bar handle 96mm',
    apiDescription: 'HANDLE Hollow Barrel  96mm   Stainless Steel',
    unitPrice: 5,
    unit: 'each',
  },
  brushed: {
    id: 'handle-brushed',
    name: 'Barrel handle 160mm brushed nickel',
    apiDescription: 'HANDLE Barrel 12x160mm Brushed Nickle',
    unitPrice: 18,
    unit: 'each',
  },
  premium: {
    id: 'handle-premium',
    name: 'Barrel handle 224mm brushed nickel',
    apiDescription: 'HANDLE Barrel 12x224mm Brushed Nickle',
    unitPrice: 22,
    unit: 'each',
  },
}

export const CABINET_LEG: HardwareItem = {
  id: 'leg-plinth',
  name: 'Adjustable plinth leg 135–185mm',
  apiDescription: 'LEG Plinth PVC Adj 135-185mm Black',
  unitPrice: 7,
  unit: 'each',
}

export const SHELF_SUPPORT: HardwareItem = {
  id: 'shelf-support',
  name: 'Shelf support (pack of 4)',
  unitPrice: 6,
  unit: 'pack',
}

/** Per-cabinet sundries allowance (screws, dowels, corner blocks, silicone). */
export const FIXINGS_ALLOWANCE: HardwareItem = {
  id: 'fixings',
  name: 'Fixings & sundries allowance',
  unitPrice: 35,
  unit: 'each',
}

export const TIER_HARDWARE: Record<'value' | 'standard' | 'premium', TierHardware> = {
  value: { hinge: HINGES.basic, runner: RUNNERS.basic, handle: HANDLES.basic, leg: CABINET_LEG },
  standard: { hinge: HINGES.softClose, runner: RUNNERS.softClose, handle: HANDLES.brushed, leg: CABINET_LEG },
  premium: { hinge: HINGES.softClose, runner: RUNNERS.underMount, handle: HANDLES.premium, leg: CABINET_LEG },
}
