import { useEffect, useMemo, useRef } from 'react'
import { useStore, STEPS, type Step } from './store'
import { DOOR_MATERIALS } from './data/boardMaterials'
import { priceAllTiers } from './engine/pricing'
import RoomForm from './ui/RoomForm'
import KitchenScene3D from './ui/KitchenScene3D'
import PricePanel from './ui/PricePanel'
import QuoteSheet from './ui/QuoteSheet'
import LayoutStep from './ui/LayoutStep'
import StyleStep from './ui/StyleStep'

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`

const STEP_ORDER: Step[] = ['room', 'layout', 'style', 'quote']

function StepPanel({ step }: { step: Step }) {
  switch (step) {
    case 'room':
      return <RoomForm />
    case 'layout':
      return <LayoutStep />
    case 'style':
      return <StyleStep />
    case 'quote':
      return <QuoteSheet />
  }
}

export default function App() {
  const { step, setStep, proposals, units, estimate, bom } = useStore()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
  }, [step])

  const currentIdx = STEP_ORDER.indexOf(step)
  // A step is reachable if it's the room step, or the prerequisites exist.
  const reachable = (s: Step): boolean => {
    if (s === 'room') return true
    if (s === 'layout') return proposals.length > 0 || currentIdx >= 1
    return units.length > 0 || currentIdx >= STEP_ORDER.indexOf(s)
  }

  const currentStep = STEPS[currentIdx]

  // Top-bar pill: "From R…" (cheapest tier) while still designing, selected-tier
  // total once the customer reaches style/quote.
  const pillTotal = useMemo(() => {
    if (currentIdx >= 2) return estimate ? { prefix: 'Estimated total', total: estimate.total } : null
    if (!bom || units.length === 0) return null
    try {
      const all = priceAllTiers(bom, {
        value: DOOR_MATERIALS.value[0],
        standard: DOOR_MATERIALS.standard[0],
        premium: DOOR_MATERIALS.premium[0],
      })
      return { prefix: 'From', total: Math.min(all.value.total, all.standard.total, all.premium.total) }
    } catch {
      return null
    }
  }, [bom, units.length, estimate, currentIdx])

  return (
    <div className="flex h-screen flex-col bg-hds-sand text-hds-black">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-4 bg-hds-black px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <img src="/images/hds-logo.webp" alt="HDS" className="h-8 w-8 rounded object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-white">Kitchen Planner</span>
        </div>

        {/* step progress — full on lg+, compact on mobile */}
        <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Progress">
          {STEPS.map((s, i) => {
            const active = s.id === step
            const done = i < currentIdx
            const canClick = reachable(s.id)
            return (
              <div key={s.id} className="flex items-center">
                {i > 0 && <span className={`mx-2 h-px w-8 ${done || active ? 'bg-hds-gold' : 'bg-white/20'}`} />}
                <button
                  onClick={() => canClick && setStep(s.id)}
                  disabled={!canClick}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-hds-gold font-semibold text-hds-black'
                      : canClick
                        ? 'text-white/80 hover:text-white'
                        : 'cursor-default text-white/40'
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-hds-black text-hds-gold' : done ? 'bg-hds-gold/20 text-hds-gold' : 'bg-white/10 text-white/60'}`}>
                    {done ? '✓' : s.n}
                  </span>
                  {s.label}
                </button>
              </div>
            )
          })}
        </nav>
        <div className="mx-auto text-sm text-white/80 lg:hidden">
          Step {currentStep.n} of 4 · <span className="font-semibold text-white">{currentStep.label}</span>
        </div>

        {pillTotal && (
          <div className="hidden rounded-full bg-hds-gold px-4 py-1.5 text-sm font-semibold text-hds-black sm:block">
            {pillTotal.prefix} {fmt(pillTotal.total)}
          </div>
        )}
      </header>

      {/* hero: 3D canvas + floating panel + price bar */}
      <div className="relative flex flex-1 flex-col overflow-hidden lg:block">
        <div className="h-[45vh] w-full lg:absolute lg:inset-0 lg:h-auto">
          <KitchenScene3D />
        </div>

        {/* step panel — floating card on lg, bottom sheet on mobile */}
        <div
          ref={panelRef}
          className="min-h-0 flex-1 overflow-y-auto border-t-4 border-t-hds-gold border-hds-border bg-white lg:absolute lg:bottom-6 lg:left-6 lg:top-6 lg:w-[400px] lg:flex-none lg:rounded-2xl lg:border lg:border-t-4 lg:border-t-hds-gold lg:shadow-float"
        >
          <div className="p-6 pb-32 lg:pb-6">
            <StepPanel step={step} />
          </div>
        </div>

        {/* price bar — floating bottom-right on lg, sticky bottom on mobile */}
        <div className="bg-hds-sand p-3 lg:pointer-events-none lg:absolute lg:bottom-6 lg:right-6 lg:bg-transparent lg:p-0">
          <PricePanel />
        </div>
      </div>
    </div>
  )
}
