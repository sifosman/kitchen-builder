import { create } from 'zustand'
import type { RoomSpec, Obstruction } from './engine/room'
import type { PlacedUnit } from './engine/rules'
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
    const { units, tier, doorMaterialId } = get()
    const next = units.map(u => {
      if (u.instanceId !== instanceId) return u
      const m = getModule(moduleId)
      return { ...u, moduleId, widthMm: m.widthMm, kind: m.kind, mounted: (m.kind === 'wall' ? 'wall' : m.kind === 'tall' ? 'tall' : u.mounted) as PlacedUnit['mounted'] }
    })
    const { bom, estimate, nest } = recalc(next, tier, doorMaterialId)
    set({ units: next, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  nudgeUnit: (instanceId, deltaMm) => {
    const { units, room } = get()
    const wall = room.walls.find(w => w.id === units.find(u => u.instanceId === instanceId)?.wallId)
    if (!wall) return
    const next = units.map(u => {
      if (u.instanceId !== instanceId) return u
      const start = Math.max(0, Math.min(wall.lengthMm - u.widthMm, u.startMm + deltaMm))
      return { ...u, startMm: Math.round(start) }
    })
    const { bom, estimate, nest } = recalc(next, get().tier, get().doorMaterialId)
    set({ units: next, bom, estimate, nest, quote: staleQuote(get().quote) })
  },

  setUnitWidth: (instanceId, widthMm) => {
    const { units } = get()
    const next = units.map(u => {
      if (u.instanceId !== instanceId) return u
      if (!['base', 'drawer', 'wall', 'tall'].includes(u.kind)) return u
      const moduleId = moduleIdFor(u.kind as 'base' | 'drawer' | 'wall' | 'tall', widthMm)
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
    const wall = room.walls.find(w => w.id === wallId)
    if (!wall) return
    // find first free slot scanning left→right
    const onWall = units.filter(u => u.wallId === wallId).sort((a, b) => a.startMm - b.startMm)
    let x = 0
    for (const u of onWall) {
      if (u.startMm >= x + m.widthMm) break
      x = Math.max(x, u.startMm + u.widthMm)
    }
    if (x + m.widthMm > wall.lengthMm) return // no room
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
