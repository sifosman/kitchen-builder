import { useState } from 'react'
import { useStore } from '../store'
import { DOOR_MATERIALS, type BoardMaterial } from '../data/boardMaterials'
import { buildBom } from '../engine/bom'
import { priceKitchen, type Tier } from '../engine/pricing'

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`

const isWoodgrain = (m: BoardMaterial) =>
  m.texture === 'woodgrain' || (m.texture === 'gloss' && /oak|driftwood|cherry/i.test(m.name))

const TIERS: { id: Tier; label: string; blurb: string }[] = [
  { id: 'value', label: 'Value', blurb: 'Melamine doors, standard hinges & runners' },
  { id: 'standard', label: 'Standard', blurb: 'Melawood doors, soft-close throughout' },
  { id: 'premium', label: 'Premium', blurb: 'Gloss / SilkTouch doors, under-mount runners' },
]

export default function StyleStep() {
  const { tier, setTier, doorMaterialId, setDoorMaterial, estimate, bom, units, setStep } = useStore()
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const materials = DOOR_MATERIALS[tier]

  const priceForTier = (t: Tier) => {
    if (units.length === 0) return null
    try {
      return priceKitchen(buildBom(units), DOOR_MATERIALS[t][0], t).total
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-hds-black">Style & finish</h2>
        <p className="mt-1 text-sm text-hds-muted">Choose a range and a door colour — the price updates live.</p>
      </div>

      <div className="space-y-2">
        {TIERS.map(t => {
          const total = priceForTier(t.id)
          const selected = tier === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-colors ${
                selected ? 'border-hds-gold shadow-card' : 'border-hds-border hover:border-hds-gold/60'
              }`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-hds-gold' : 'border-hds-border'}`}>
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-hds-gold" />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-hds-black">
                  {t.label}
                  {t.id === 'standard' && (
                    <span className="ml-2 rounded-full bg-hds-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-hds-black">Most popular</span>
                  )}
                </span>
                <span className="block text-xs text-hds-muted">{t.blurb}</span>
              </span>
              {total !== null && <span className="text-sm font-semibold text-hds-black">{fmt(total)}</span>}
            </button>
          )
        })}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-hds-black">Door colour</p>
        {([
          ['Woodgrains', materials.filter(m => isWoodgrain(m))],
          ['Plain & textured colours', materials.filter(m => !isWoodgrain(m))],
        ] as const).map(([label, group]) =>
          group.length === 0 ? null : (
            <div key={label} className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-hds-muted">{label}</p>
              <div className="grid grid-cols-3 gap-3">
                {group.map(m => {
                  const selected = doorMaterialId === m.id
                  return (
                    <button key={m.id} onClick={() => setDoorMaterial(m.id)} className="group text-left">
                      <span
                        className={`relative block aspect-square overflow-hidden rounded-xl border-2 transition-colors ${
                          selected ? 'border-hds-gold ring-2 ring-hds-gold/40' : 'border-hds-border group-hover:border-hds-gold/60'
                        }`}
                        style={{ backgroundColor: m.hex }}
                      >
                        {m.renderTexture && (
                          <img src={m.renderTexture} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
                        )}
                        {selected && (
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-hds-gold text-[11px] font-bold text-hds-black">✓</span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs font-medium text-hds-black">{m.name}</span>
                      <span className="block text-[11px] text-hds-muted">R{m.pricePerSheet}/sheet</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ),
        )}
      </div>

      {estimate && (
        <div className="rounded-xl border border-hds-border bg-white">
          <button
            onClick={() => setBreakdownOpen(v => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-hds-black"
          >
            See what's included
            <span className={`inline-block text-hds-muted transition-transform ${breakdownOpen ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {breakdownOpen && (
            <div className="space-y-1.5 border-t border-hds-border px-4 py-3 text-sm">
              <div className="flex justify-between text-hds-muted"><span>Carcass board ({estimate.carcassSheets} sheets)</span><span>{fmt(estimate.carcassCost)}</span></div>
              <div className="flex justify-between text-hds-muted"><span>Door board ({estimate.doorSheets} sheets)</span><span>{fmt(estimate.doorCost)}</span></div>
              <div className="flex justify-between text-hds-muted"><span>Backing board ({estimate.backerSheets})</span><span>{fmt(estimate.backerCost)}</span></div>
              <div className="flex justify-between text-hds-muted"><span>Edging ({bom ? (bom.edgingMetres.carcass + bom.edgingMetres.door).toFixed(1) : 0} m)</span><span>{fmt(estimate.edgingCost)}</span></div>
              <div className="flex justify-between text-hds-muted"><span>Hardware</span><span>{fmt(estimate.hardwareCost)}</span></div>
              <div className="flex justify-between text-hds-muted"><span>Cutting</span><span>{fmt(estimate.cuttingCost)}</span></div>
              <div className="flex justify-between text-hds-muted"><span>Assembly & fit</span><span>{fmt(estimate.labourCost)}</span></div>
              <div className="flex justify-between border-t border-hds-border pt-2 text-base font-semibold text-hds-black">
                <span>Estimated total (VAT incl)</span><span>{fmt(estimate.total)}</span>
              </div>
              <p className="pt-1 text-[11px] text-hds-muted">Estimate only — your formal quote confirms the final price.</p>
            </div>
          )}
        </div>
      )}

      <button onClick={() => setStep('quote')} className="hds-btn-gold">
        Get my quote →
      </button>
    </div>
  )
}
