import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { allDoorMaterials, findDoorMaterial, RANGES, type BoardMaterial, type MaterialRange } from '../data/boardMaterials'
import { buildBom } from '../engine/bom'
import { priceKitchen } from '../engine/pricing'

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`

const isWoodgrain = (m: BoardMaterial) =>
  m.texture === 'woodgrain' || (m.texture === 'gloss' && /oak|driftwood|cherry/i.test(m.name)) ||
  m.texture === 'linear'

export default function StyleStep() {
  const { doorMaterialId, setDoorMaterial, estimate, bom, units, setStep } = useStore()
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  const selectedMat = findDoorMaterial(doorMaterialId)
  const [rangeTab, setRangeTab] = useState<MaterialRange>(selectedMat?.range ?? 'melawood')

  // keep the tab in sync when the material's range changes (price bar, defaults)
  useEffect(() => {
    if (selectedMat) setRangeTab(selectedMat.range)
  }, [doorMaterialId]) // eslint-disable-line react-hooks/exhaustive-deps

  const rangeMats = allDoorMaterials().filter(m => m.range === rangeTab)
  const rangeMeta = RANGES.find(r => r.id === rangeTab)!

  // estimate for this kitchen in the range's tier — the selected material if
  // it's in this range, otherwise the range's default board
  const rangeEstimate = (() => {
    if (units.length === 0) return null
    const mat = rangeMats.find(m => m.id === doorMaterialId) ?? rangeMats[0]
    if (!mat) return null
    try {
      return priceKitchen(buildBom(units), mat, rangeMeta.tier).total
    } catch {
      return null
    }
  })()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-hds-black">Style & finish</h2>
        <p className="mt-1 text-sm text-hds-muted">Choose a range and a door colour — the price updates live.</p>
      </div>

      {/* range tabs */}
      <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-hds-sand p-1.5">
        {RANGES.map(r => {
          const mats = allDoorMaterials().filter(m => m.range === r.id)
          const from = Math.min(...mats.map(m => m.pricePerSheet))
          const active = rangeTab === r.id
          return (
            <button
              key={r.id}
              onClick={() => setRangeTab(r.id)}
              className={`rounded-lg px-2 py-2 text-center transition-colors ${
                active ? 'bg-hds-black text-white shadow-card' : 'text-hds-black hover:bg-white'
              }`}
            >
              <span className="block text-xs font-semibold">{r.label}</span>
              <span className={`block text-[10px] ${active ? 'text-white/70' : 'text-hds-muted'}`}>from R{from.toLocaleString('en-ZA')}</span>
            </button>
          )
        })}
      </div>
      <p className="-mt-3 text-xs text-hds-muted">
        {rangeMeta.label} doors · {rangeMeta.blurb}
        {rangeEstimate !== null && <> · estimated <span className="font-medium text-hds-black">{fmt(rangeEstimate)}</span> for this kitchen</>}
      </p>

      <div>
        {([
          ['Woodgrains', rangeMats.filter(m => isWoodgrain(m))],
          ['Plain & textured colours', rangeMats.filter(m => !isWoodgrain(m))],
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
