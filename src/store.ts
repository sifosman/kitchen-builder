import { create } from 'zustand'
import { freeSpans, type RoomSpec, type Obstruction } from './engine/room'
import { CORNER_DEAD_BASE_MM, CORNER_DEAD_WALL_MM, type PlacedUnit } from './engine/rules'
import { proposeLayouts, type Proposal } from './engine/propose'
import { buildBom, type Bom } from './engine/bom'
import { priceKitchen, type PriceBreakdown, type Tier } from './engine/pricing'
import { nestBom, type NestResult } from './engine/nest'
import { DOOR_MATERIALS, findDoorMaterial, tierForMaterial } from './data/boardMaterials'
import { CABINET_LIBRARY, getModule, moduleIdFor } from './data/cabinetLibrary'
import type { QuoteResult } from './api/optimizerClient'

export type Step = 'room' | 'layout' | 'style' | 'quote'

export const STEPS: { id: Step; n: number; label: string }[] = [
  { id: 'room', n: 1, label: 'Your room' },
  { id: 'layout', n: 2, label: 'Your layout' },
  { id: 'style', n: 3, label: 'Style & finish' },
  { id: 'quote', n: 4, label: 'Your quote' },
]

interface KitchenState {
  room: RoomSpec
  step: Step
  proposals: Proposal[]
  selectedProposalId: string | null
  units: PlacedUnit[]
  selectedUnitId: string | null
  tier: Tier
  doorMaterialId: string
  bom: Bom | null
  estimate: PriceBreakdown | null
  nest: NestResult | null
  /** short id for this design — used in printed label QR codes */
  designId: string
  customer: { name: string; phone: string; project: string }
  quote: { status: 'idle' | 'sending' | 'done' | 'error'; result: QuoteResult | null }

  setRoom: (room: RoomSpec) => void
  generate: () => void
  selectProposal: (id: string) => void
  selectUnit: (id: string | null) => void
  swapUnitModule: (instanceId: string, moduleId: string) => void
  nudgeUnit: (instanceId: string, deltaMm: number) => void
  setUnitWidth: (instanceId: string, widthMm: number) => void
  removeUnit: (instanceId: string) => void
  addUnit: (moduleId: string, wallId: string) => void
  setTier: (t: Tier) => void
  setDoorMaterial: (id: string) => void
  setCustomer: (c: Partial<KitchenState['customer']>) => void
  setQuote: (q: KitchenState['quote']) => void
  setStep: (s: Step) => void
  resetDesign: () => void
}

const defaultRoom: RoomSpec = {
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

const newDesignId = () => `D-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

function recalc(units: PlacedUnit[], tier: Tier, doorMaterialId: string) {
  const bom = buildBom(units)
  const doorMat = findDoorMaterial(doorMaterialId) ?? DOOR_MATERIALS[tier][0]
  const nest = bom.lines.length > 0 ? nestBom(bom, doorMat) : null
  const estimate = priceKitchen(bom, doorMat, tier, nest ? {
    carcass: nest.byMaterial.carcass.boards,
    door: nest.byMaterial.door.boards,
    back: nest.byMaterial.back.boards,
  } : undefined)
  return { bom, estimate, nest }
}

/** A design change after a quote was generated invalidates it. */
function staleQuote(q: KitchenState['quote']): KitchenState['quote'] {
  if (q.status === 'done' || q.status === 'error') return { status: 'idle', result: q.result }
  return q
}

/**
 * The legal interval [lo, hi) for a unit on its wall: the obstruction-free
 * span it's in, clipped by same-band neighbours and the corner dead zone on
 * secondary walls. Edits (move/resize/swap) clamp to this so a cabinet can
 * never be dragged over an appliance, door or the corner.
 */
function freeInterval(units: PlacedUnit[], room: RoomSpec, u: PlacedUnit): { lo: number; hi: number } {
  const wi = room.walls.findIndex(w => w.id === u.wallId)
  const wall = room.walls[wi]
  if (!wall) return { lo: u.startMm, hi: u.startMm + u.widthMm }
  const isWallBand = u.mounted === 'wall'
  const span = freeSpans(wall, isWallBand).find(
    s => u.startMm >= s.startMm && u.startMm + u.widthMm <= s.endMm,
  ) ?? freeSpans(wall, isWallBand).find(s => u.startMm < s.endMm && s.startMm < u.startMm + u.widthMm)
  let lo = span?.startMm ?? 0
  let hi = span?.endMm ?? wall.lengthMm
  if (wi > 0) lo = Math.max(lo, isWallBand ? CORNER_DEAD_WALL_MM : CORNER_DEAD_BASE_MM)
  for (const n of units) {
    if (n.instanceId === u.instanceId || n.wallId !== u.wallId || (n.mounted === 'wall') !== isWallBand) continue
    if (n.startMm + n.widthMm <= u.startMm) lo = Math.max(lo, n.startMm + n.widthMm)
    else if (n.startMm >= u.startMm + u.widthMm) hi = Math.min(hi, n.startMm)
  }
  return { lo, hi }
}

export const useStore = create<KitchenState>((set, get) => ({
  room: defaultRoom,
  step: 'room',
  proposals: [],
  selectedProposalId: null,
  units: [],
  selectedUnitId: null,
  tier: 'standard',
  doorMaterialId: DOOR_MATERIALS.standard[0].id,
  bom: null,
  estimate: null,
  nest: null,
  designId: newDesignId(),
  customer: { name: '', phone: '', project: '' },
  quote: { status: 'idle', result: null },

  setRoom: room => set({ room }),

  generate: () => {
    const { room, tier, doorMaterialId } = get()
    const proposals = proposeLayouts(room, 3)
    const selected = proposals[0] ?? null
    const units = selected ? selected.units.map(u => ({ ...u })) : []
    const { bom, estimate, nest } = recalc(units, tier, doorMaterialId)
    set({
      proposals,
      selectedProposalId: selected?.id ?? null,
      units,
      bom,
      estimate,
      nest,
      step: 'layout',
      selectedUnitId: null,
      quote: { status: 'idle', result: null },
    })
  },

  selectProposal: id => {
    const { proposals, tier, doorMaterialId } = get()
    const p = proposals.find(p => p.id === id)
    if (!p) return
    const units = p.units.map(u => ({ ...u }))
    const { bom, estimate, nest } = recalc(units, tier, doorMaterialId)
    set({ selectedProposalId: id, units, bom, estimate, nest, selectedUnitId: null, quote: staleQuote(get().quote) })
  },

  selectUnit: id => set({ selectedUnitId: id }),

  swapUnitModule: (instanceId, moduleId) => {
    const { units, tier, doorMaterialId, room } = get()
    const target = units.find(u => u.instanceId === instanceId)
    if (!target) return
    const m = getModule(moduleId)
    // don't let a wider module swallow the neighbour — clamp to free space
    const avail = freeInterval(units, room, target).hi - target.startMm
    if (m.widthMm > avail) {
      if (!['base', 'drawer', 'wall', 'tall'].includes(m.kind) || avail < 300) return
      moduleId = moduleIdFor(m.kind as 'base' | 'drawer' | 'wall' | 'tall', avail)
    }
    const mod = getModule(moduleId)
    const next = units.map(u => {
      if (u.instanceId !== instanceId) return u
      return { ...u, moduleId, widthMm: mod.widthMm, kind: mod.kind, mounted: (mod.kind === 'wall' ? 'wall' : mod.kind === 'tall' ? 'tall' : u.mounted) as PlacedUnit['mounted'] }
    })
    const { bom, estimate, nest } = recalc(next, tier, doorMaterialId)
    set({ units: next, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  nudgeUnit: (instanceId, deltaMm) => {
    const { units, room } = get()
    const unit = units.find(u => u.instanceId === instanceId)
    if (!unit) return
    const { lo, hi } = freeInterval(units, room, unit)
    const start = Math.max(lo, Math.min(hi - unit.widthMm, unit.startMm + deltaMm))
    if (start === unit.startMm) return
    const next = units.map(u => (u.instanceId === instanceId ? { ...u, startMm: Math.round(start) } : u))
    const { bom, estimate, nest } = recalc(next, get().tier, get().doorMaterialId)
    set({ units: next, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  setUnitWidth: (instanceId, widthMm) => {
    const { units, room } = get()
    const target = units.find(u => u.instanceId === instanceId)
    if (!target || !['base', 'drawer', 'wall', 'tall'].includes(target.kind)) return
    const maxW = freeInterval(units, room, target).hi - target.startMm
    const w = Math.min(widthMm, Math.floor(maxW))
    if (w < 300) return
    const next = units.map(u => {
      if (u.instanceId !== instanceId) return u
      const moduleId = moduleIdFor(u.kind as 'base' | 'drawer' | 'wall' | 'tall', w)
      const m = getModule(moduleId)
      return { ...u, moduleId, widthMm: m.widthMm }
    })
    const { bom, estimate, nest } = recalc(next, get().tier, get().doorMaterialId)
    set({ units: next, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  removeUnit: instanceId => {
    const next = get().units.filter(u => u.instanceId !== instanceId)
    const { bom, estimate, nest } = recalc(next, get().tier, get().doorMaterialId)
    set({ units: next, bom, estimate, nest, selectedUnitId: null, quote: staleQuote(get().quote) })
  },

  addUnit: (moduleId, wallId) => {
    const { units, room } = get()
    const m = getModule(moduleId)
    const wi = room.walls.findIndex(w => w.id === wallId)
    const wall = room.walls[wi]
    if (!wall) return
    // first free slot: obstruction-free span ∩ gap between same-band units,
    // never inside the corner dead zone on a secondary wall
    const isWallBand = m.kind === 'wall'
    const dead = wi > 0 ? (isWallBand ? CORNER_DEAD_WALL_MM : CORNER_DEAD_BASE_MM) : 0
    const onWall = units
      .filter(u => u.wallId === wallId && (u.mounted === 'wall') === isWallBand)
      .sort((a, b) => a.startMm - b.startMm)
    let x: number | undefined
    for (const sp of freeSpans(wall, isWallBand)) {
      const e = sp.endMm
      let cursor = Math.max(sp.startMm, dead)
      for (const u of onWall) {
        if (u.startMm + u.widthMm <= cursor || u.startMm >= e) continue
        if (u.startMm >= cursor + m.widthMm) break
        cursor = u.startMm + u.widthMm
      }
      if (e - cursor >= m.widthMm) {
        x = cursor
        break
      }
    }
    if (x === undefined) return // no room
    const nu: PlacedUnit = {
      instanceId: `${wallId}-M${Date.now().toString(36)}`,
      moduleId,
      wallId,
      startMm: x,
      widthMm: m.widthMm,
      kind: m.kind,
      mounted: m.kind === 'wall' ? 'wall' : m.kind === 'tall' ? 'tall' : 'base',
    }
    const next = [...units, nu]
    const { bom, estimate, nest } = recalc(next, get().tier, get().doorMaterialId)
    set({ units: next, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  setTier: tier => {
    const { units, doorMaterialId } = get()
    // if the chosen door material isn't in this tier, fall back to tier default
    const inTier = DOOR_MATERIALS[tier].some(m => m.id === doorMaterialId)
    const matId = inTier ? doorMaterialId : DOOR_MATERIALS[tier][0].id
    const { bom, estimate, nest } = recalc(units, tier, matId)
    set({ tier, doorMaterialId: matId, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  setDoorMaterial: id => {
    const { units } = get()
    const tier = tierForMaterial(id)
    const { bom, estimate, nest } = recalc(units, tier, id)
    set({ doorMaterialId: id, tier, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  setCustomer: c => set({ customer: { ...get().customer, ...c } }),
  setQuote: q => set({ quote: q }),
  setStep: s => set({ step: s }),

  resetDesign: () =>
    set({
      room: defaultRoom,
      step: 'room',
      proposals: [],
      selectedProposalId: null,
      units: [],
      selectedUnitId: null,
      bom: null,
      estimate: null,
      nest: null,
      designId: newDesignId(),
      quote: { status: 'idle', result: null },
    }),
}))

export { CABINET_LIBRARY }
export type { Obstruction }
