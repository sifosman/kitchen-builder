import { useMemo } from 'react'
import { useStore } from '../store'
import { DOOR_MATERIALS } from '../data/boardMaterials'
import { priceAllTiers, type Tier } from '../engine/pricing'

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`

const TIERS: { id: Tier; label: string }[] = [
  { id: 'value', label: 'Value' },
  { id: 'standard', label: 'Standard' },
  { id: 'premium', label: 'Premium' },
]

export default function PricePanel() {
  const { tier, setTier, bom, units, setStep } = useStore()

  const prices = useMemo(() => {
    if (!bom || units.length === 0) return null
    try {
      return priceAllTiers(bom, {
        value: DOOR_MATERIALS.value[0],
        standard: DOOR_MATERIALS.standard[0],
        premium: DOOR_MATERIALS.premium[0],
      })
    } catch {
      return null
    }
  }, [bom, units.length])

  if (!prices) return null

  return (
    <div className="pointer-events-auto w-full rounded-2xl bg-white p-4 shadow-float lg:w-[380px]">
      <div className="flex gap-2">
        {TIERS.map(t => {
          const selected = tier === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              className={`relative flex-1 rounded-xl border-2 px-2 py-2 text-center transition-colors ${
                selected ? 'border-hds-gold bg-hds-gold/10' : 'border-hds-border hover:border-hds-gold/60'
              }`}
            >
              {t.id === 'standard' && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-hds-black px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-hds-gold">
                  Most popular
                </span>
              )}
              <span className={`block text-xs font-medium ${selected ? 'text-hds-black' : 'text-hds-muted'}`}>{t.label}</span>
              <span className={`block text-sm transition-all ${selected ? 'font-bold text-hds-black' : 'font-medium text-hds-black'}`}>
                {fmt(prices[t.id].total)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <p className="flex-1 text-[11px] text-hds-muted">incl VAT · estimate</p>
        <button
          onClick={() => setStep('quote')}
          className="rounded-xl bg-hds-gold px-5 py-2.5 text-sm font-semibold text-hds-black transition-colors hover:bg-hds-goldHover"
        >
          Get my quote →
        </button>
      </div>
    </div>
  )
}
