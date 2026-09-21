import { useStore } from '../store'
import { DOOR_MATERIALS } from '../data/boardMaterials'
import type { Tier } from '../engine/pricing'

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`

const TIERS: { id: Tier; label: string; blurb: string }[] = [
  { id: 'value', label: 'Value', blurb: 'Melamine doors, standard hinges & runners' },
  { id: 'standard', label: 'Standard', blurb: 'Melawood doors, soft-close throughout' },
  { id: 'premium', label: 'Premium', blurb: 'Gloss / SilkTouch doors, under-mount runners' },
]

export default function PricePanel() {
  const { tier, setTier, doorMaterialId, setDoorMaterial, estimate, bom } = useStore()
  const materials = DOOR_MATERIALS[tier]

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tier</label>
        <div className="grid grid-cols-3 gap-1">
          {TIERS.map(t => (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              className={`px-2 py-2 rounded text-sm font-medium ${tier === t.id ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">{TIERS.find(t => t.id === tier)?.blurb}</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Door / front colour</label>
        <select
          value={doorMaterialId}
          onChange={e => setDoorMaterial(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm"
        >
          {materials.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — R{m.pricePerSheet}/sheet
            </option>
          ))}
        </select>
      </div>

      {estimate && (
        <div className="border border-neutral-800 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-400"><span>Carcass board ({estimate.carcassSheets} sheets)</span><span>{fmt(estimate.carcassCost)}</span></div>
          <div className="flex justify-between text-gray-400"><span>Door board ({estimate.doorSheets} sheets)</span><span>{fmt(estimate.doorCost)}</span></div>
          <div className="flex justify-between text-gray-400"><span>Backing board ({estimate.backerSheets})</span><span>{fmt(estimate.backerCost)}</span></div>
          <div className="flex justify-between text-gray-400"><span>Edging ({bom ? (bom.edgingMetres.carcass + bom.edgingMetres.door).toFixed(1) : 0} m)</span><span>{fmt(estimate.edgingCost)}</span></div>
          <div className="flex justify-between text-gray-400"><span>Hardware</span><span>{fmt(estimate.hardwareCost)}</span></div>
          <div className="flex justify-between text-gray-400"><span>Cutting</span><span>{fmt(estimate.cuttingCost)}</span></div>
          <div className="flex justify-between text-gray-400"><span>Assembly & fit</span><span>{fmt(estimate.labourCost)}</span></div>
          <div className="flex justify-between pt-2 border-t border-neutral-800 font-semibold text-white text-base">
            <span>Estimated total (VAT incl)</span><span>{fmt(estimate.total)}</span>
          </div>
          <p className="text-[11px] text-gray-600">Estimate only — the quote API confirms the authoritative price.</p>
        </div>
      )}
    </div>
  )
}
