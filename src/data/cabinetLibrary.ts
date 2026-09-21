// Standard HDS cabinet library — V1 per CEO spec.
// Construction convention (16mm melamine carcass):
//   base 720h × 560d on 150mm adjustable legs (worktop lands ~910mm)
//   wall 720h × 300d, hung at 1450–2170mm
//   tall 2100h × 580d (broom/grocery/oven housing)
// Edging strings follow the quote API convention: L1/L2 = long edges,
// W1/W2 = short edges, '1' = all four sides.

export type CabinetKind =
  | 'base'
  | 'wall'
  | 'tall'
  | 'drawer'
  | 'sink'
  | 'oven'
  | 'filler'
  | 'fridge'
  | 'hob'
  | 'dishwasher'

export type PanelMaterial = 'carcass' | 'door' | 'back'

export interface PanelSpec {
  part: string
  lengthMm: number
  widthMm: number
  qty: number
  edging: string
  material: PanelMaterial
}

export interface HardwareSpec {
  hinges: number
  runnerPairs: number
  handles: number
  legs: number
  shelfSupportPacks: number
  fixings: number
}

export interface CabinetModule {
  id: string
  name: string
  kind: CabinetKind
  widthMm: number
  heightMm: number
  depthMm: number
  panels: PanelSpec[]
  hardware: HardwareSpec
  /** Widths this module can be swapped to (same kind) in the UI. */
  variants?: string[]
}

const T = 16
const BASE_H = 720
const BASE_D = 560
const WALL_H = 720
const WALL_D = 300
const TALL_H = 2100
const TALL_D = 580

const noHardware: HardwareSpec = {
  hinges: 0, runnerPairs: 0, handles: 0, legs: 0, shelfSupportPacks: 0, fixings: 0,
}

function baseCarcass(w: number, opts: { shelf?: boolean } = {}): PanelSpec[] {
  const inner = w - 2 * T
  const panels: PanelSpec[] = [
    { part: 'Side', lengthMm: BASE_H, widthMm: BASE_D, qty: 2, edging: 'L1', material: 'carcass' },
    { part: 'Bottom', lengthMm: inner, widthMm: BASE_D, qty: 1, edging: '', material: 'carcass' },
    { part: 'Top rail', lengthMm: inner, widthMm: 80, qty: 2, edging: '', material: 'carcass' },
    { part: 'Back', lengthMm: w - 4, widthMm: BASE_H - 4, qty: 1, edging: '', material: 'back' },
  ]
  if (opts.shelf !== false) {
    panels.push({ part: 'Shelf', lengthMm: inner - 2, widthMm: BASE_D - 30, qty: 1, edging: 'L1', material: 'carcass' })
  }
  return panels
}

function wallCarcass(w: number): PanelSpec[] {
  const inner = w - 2 * T
  return [
    { part: 'Side', lengthMm: WALL_H, widthMm: WALL_D, qty: 2, edging: 'L1,L2', material: 'carcass' },
    { part: 'Top/Bottom', lengthMm: inner, widthMm: WALL_D, qty: 2, edging: '', material: 'carcass' },
    { part: 'Back', lengthMm: w - 4, widthMm: WALL_H - 4, qty: 1, edging: '', material: 'back' },
    { part: 'Shelf', lengthMm: inner - 2, widthMm: WALL_D - 30, qty: 1, edging: 'L1', material: 'carcass' },
  ]
}

function tallCarcass(w: number): PanelSpec[] {
  const inner = w - 2 * T
  return [
    { part: 'Side', lengthMm: TALL_H, widthMm: TALL_D, qty: 2, edging: 'L1', material: 'carcass' },
    { part: 'Top/Bottom', lengthMm: inner, widthMm: TALL_D, qty: 2, edging: '', material: 'carcass' },
    { part: 'Back', lengthMm: w - 4, widthMm: TALL_H - 4, qty: 1, edging: '', material: 'back' },
    { part: 'Shelf', lengthMm: inner - 2, widthMm: TALL_D - 30, qty: 3, edging: 'L1', material: 'carcass' },
  ]
}

/** Doors for a unit: single door ≤600mm, pair of doors above that. */
function doors(w: number, h: number): PanelSpec[] {
  const gap = 4
  const doorH = h - 3
  if (w <= 600) {
    return [{ part: 'Door', lengthMm: doorH, widthMm: w - gap, qty: 1, edging: '1', material: 'door' }]
  }
  const doorW = Math.floor((w - 3 * gap) / 2)
  return [{ part: 'Door', lengthMm: doorH, widthMm: doorW, qty: 2, edging: '1', material: 'door' }]
}

function baseModule(w: number, opts: { shelf?: boolean } = {}): CabinetModule {
  const doorCount = w <= 600 ? 1 : 2
  return {
    id: `B${w}`,
    name: `Base unit ${w}`,
    kind: 'base',
    widthMm: w,
    heightMm: BASE_H,
    depthMm: BASE_D,
    panels: [...baseCarcass(w, opts), ...doors(w, BASE_H)],
    hardware: {
      hinges: doorCount * 2,
      runnerPairs: 0,
      handles: doorCount,
      legs: w >= 900 ? 6 : 4,
      shelfSupportPacks: opts.shelf === false ? 0 : 1,
      fixings: 1,
    },
  }
}

function wallModule(w: number): CabinetModule {
  const doorCount = w <= 600 ? 1 : 2
  return {
    id: `W${w}`,
    name: `Wall unit ${w}`,
    kind: 'wall',
    widthMm: w,
    heightMm: WALL_H,
    depthMm: WALL_D,
    panels: [...wallCarcass(w), ...doors(w, WALL_H)],
    hardware: {
      hinges: doorCount * 2,
      runnerPairs: 0,
      handles: doorCount,
      legs: 0,
      shelfSupportPacks: 1,
      fixings: 1,
    },
  }
}

function tallModule(w: number, name: string): CabinetModule {
  return {
    id: `T${w}`,
    name,
    kind: 'tall',
    widthMm: w,
    heightMm: TALL_H,
    depthMm: TALL_D,
    panels: [...tallCarcass(w), ...doors(w, TALL_H)],
    hardware: {
      hinges: 2 * 5,
      runnerPairs: 0,
      handles: 2,
      legs: 0,
      shelfSupportPacks: 3,
      fixings: 2,
    },
  }
}

function drawerModule(w: number, drawers = 3): CabinetModule {
  const inner = w - 2 * T
  const frontH = Math.floor(BASE_H / drawers) - 4
  const drawerSide = BASE_D - 60
  const panels: PanelSpec[] = [...baseCarcass(w, { shelf: false })]
  for (let i = 0; i < drawers; i++) {
    panels.push(
      { part: `Drawer side`, lengthMm: drawerSide, widthMm: 140, qty: 2, edging: 'L1', material: 'carcass' },
      { part: `Drawer front/back`, lengthMm: inner - 28, widthMm: 140, qty: 2, edging: '', material: 'carcass' },
      { part: `Drawer base`, lengthMm: inner - 28, widthMm: drawerSide - 20, qty: 1, edging: '', material: 'carcass' },
      { part: `Drawer front`, lengthMm: frontH, widthMm: w - 4, qty: 1, edging: '1', material: 'door' },
    )
  }
  return {
    id: `D${w}`,
    name: `Drawer unit ${w} (${drawers} drawers)`,
    kind: 'drawer',
    widthMm: w,
    heightMm: BASE_H,
    depthMm: BASE_D,
    panels,
    hardware: {
      hinges: 0,
      runnerPairs: drawers,
      handles: drawers,
      legs: w >= 900 ? 6 : 4,
      shelfSupportPacks: 0,
      fixings: 1,
    },
  }
}

function sinkModule(w: number): CabinetModule {
  const doorCount = w <= 600 ? 1 : 2
  return {
    id: `SINK${w}`,
    name: `Sink unit ${w}`,
    kind: 'sink',
    widthMm: w,
    heightMm: BASE_H,
    depthMm: BASE_D,
    panels: [...baseCarcass(w, { shelf: false }), ...doors(w, BASE_H)],
    hardware: {
      hinges: doorCount * 2,
      runnerPairs: 0,
      handles: doorCount,
      legs: w >= 900 ? 6 : 4,
      shelfSupportPacks: 0,
      fixings: 1,
    },
  }
}

function ovenModule(w: number): CabinetModule {
  const inner = w - 2 * T
  return {
    id: `OVEN${w}`,
    name: `Oven unit ${w}`,
    kind: 'oven',
    widthMm: w,
    heightMm: BASE_H,
    depthMm: BASE_D,
    panels: [
      ...baseCarcass(w, { shelf: false }),
      { part: 'Oven shelf', lengthMm: inner - 2, widthMm: BASE_D - 30, qty: 1, edging: 'L1', material: 'carcass' },
      { part: 'Drawer front', lengthMm: 140, widthMm: w - 4, qty: 1, edging: '1', material: 'door' },
    ],
    hardware: { hinges: 0, runnerPairs: 0, handles: 1, legs: 4, shelfSupportPacks: 1, fixings: 1 },
  }
}

function fillerModule(w: number): CabinetModule {
  return {
    id: `F${w}`,
    name: `Filler ${w}`,
    kind: 'filler',
    widthMm: w,
    heightMm: BASE_H,
    depthMm: 100,
    panels: [{ part: 'Filler panel', lengthMm: BASE_H, widthMm: w, qty: 1, edging: '1', material: 'door' }],
    hardware: { ...noHardware, fixings: 1 },
  }
}

/** Space-holding appliance slot — no panels, reserves room on the wall. */
function appliance(id: string, name: string, kind: CabinetKind, w: number, h: number, d: number): CabinetModule {
  return {
    id,
    name,
    kind,
    widthMm: w,
    heightMm: h,
    depthMm: d,
    panels: [],
    hardware: { ...noHardware },
  }
}

export const CABINET_LIBRARY: CabinetModule[] = [
  // Base units
  baseModule(300),
  baseModule(450),
  baseModule(600),
  baseModule(900),
  // Wall units
  wallModule(300),
  wallModule(450),
  wallModule(600),
  wallModule(900),
  // Tall units
  tallModule(450, 'Tall unit 450 (broom)'),
  tallModule(600, 'Tall unit 600 (grocery)'),
  // Drawer units
  drawerModule(450, 3),
  drawerModule(600, 3),
  drawerModule(900, 3),
  // Specials
  sinkModule(600),
  sinkModule(900),
  sinkModule(1000),
  ovenModule(600),
  // Fillers
  fillerModule(50),
  fillerModule(80),
  fillerModule(100),
  // Appliance slots
  appliance('FRIDGE600', 'Fridge 600 (single)', 'fridge', 600, 1800, 650),
  appliance('FRIDGE900', 'Fridge 900 (double)', 'fridge', 900, 1800, 700),
  appliance('HOB600', 'Hob + extractor 600', 'hob', 600, 900, 560),
  appliance('DW600', 'Dishwasher 600', 'dishwasher', 600, 870, 560),
]

const CUSTOM_ID = /^(B|D|W|T)(\d{3,4})$/
const CUSTOM_RANGES: Record<string, [number, number]> = {
  B: [300, 1000],
  D: [300, 1000],
  W: [300, 1000],
  T: [300, 600],
}
const customCache = new Map<string, CabinetModule>()

export function getModule(id: string): CabinetModule {
  const m = CABINET_LIBRARY.find(m => m.id === id)
  if (m) return m
  const match = CUSTOM_ID.exec(id)
  if (match) {
    const cached = customCache.get(id)
    if (cached) return cached
    const w = Number(match[2])
    const [min, max] = CUSTOM_RANGES[match[1]]
    if (w < min || w > max) throw new Error(`Custom module ${id} out of range ${min}–${max}mm`)
    const built =
      match[1] === 'B' ? { ...baseModule(w), name: `Base unit ${w} (cut to size)` }
      : match[1] === 'D' ? { ...drawerModule(w), name: `Drawer unit ${w} (cut to size)` }
      : match[1] === 'W' ? { ...wallModule(w), name: `Wall unit ${w} (cut to size)` }
      : tallModule(w, `Tall unit ${w} (cut to size)`)
    customCache.set(id, built)
    return built
  }
  throw new Error(`Unknown cabinet module: ${id}`)
}

/** Module id for a parametric cabinet of the given kind and width. */
export function moduleIdFor(kind: 'base' | 'drawer' | 'wall' | 'tall', widthMm: number): string {
  const prefix = { base: 'B', drawer: 'D', wall: 'W', tall: 'T' }[kind]
  return `${prefix}${Math.round(widthMm)}`
}

/** Fillable base widths (excluding specials/appliances) used by the fit engine. */
export const BASE_FILL_WIDTHS = [300, 450, 600, 900] as const
export const WALL_FILL_WIDTHS = [300, 450, 600, 900] as const
export const FILLER_WIDTHS = [50, 80, 100] as const
