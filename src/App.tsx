import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, STEPS, type Step } from './store'
import { DOOR_MATERIALS } from './data/boardMaterials'
import { priceAllTiers } from './engine/pricing'
import RoomForm from './ui/RoomForm'
import KitchenScene3D from './ui/KitchenScene3D'
import PlanView from './ui/PlanView'
import ElevationView from './ui/ElevationView'
import PricePanel from './ui/PricePanel'
import QuoteSheet from './ui/QuoteSheet'
import LayoutStep from './ui/LayoutStep'
import StyleStep from './ui/StyleStep'
import LabelSheet from './ui/LabelSheet'

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`

const STEP_ORDER: Step[] = ['room', 'layout', 'style', 'quote']
const VIEWS = [
  { id: '3d', label: '3D' },
  { id: 'plan', label: 'Plan' },
  { id: 'elevation', label: 'Elevation' },
] as const
type View = (typeof VIEWS)[number]['id']

function StepPanel({ step }: { step: Step }) {
  const { setStep } = useStore()
  const idx = STEP_ORDER.indexOf(step)
  return (
    <>
      {idx > 0 && (
        <button
          onClick={() => setStep(STEP_ORDER[idx - 1])}
          className="mb-4 flex items-center gap-1 text-sm font-medium text-hds-muted transition-colors hover:text-hds-black"
        >
          ← Back
        </button>
      )}
      {step === 'room' && <RoomForm />}
      {step === 'layout' && <LayoutStep />}
      {step === 'style' && <StyleStep />}
      {step === 'quote' && <QuoteSheet />}
    </>
  )
}

export default function App() {
  // printable label sheet lives outside the planner chrome — before any hooks
  if (new URLSearchParams(window.location.search).get('print') === 'labels') {
    return <LabelSheet />
  }
  return <PlannerApp />
}

function PlannerApp() {
  const { step, setStep, proposals, units, estimate, bom } = useStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('3d')

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
  }, [step])

  const currentIdx = STEP_ORDER.indexOf(step)
  // a step is clickable once it has data — room always, the rest once a layout exists
  const reachable = (s: Step): boolean =>
    s === 'room' || units.length > 0 || (s === 'layout' && proposals.length > 0) || currentIdx >= STEP_ORDER.indexOf(s)

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

      {/* hero: 3D/Plan/Elevation + floating panel + price bar */}
      <div className="relative flex flex-1 flex-col overflow-hidden lg:block">
        <div className="relative h-[45vh] w-full lg:absolute lg:inset-0 lg:h-auto">
          {view === '3d' ? <KitchenScene3D /> : view === 'plan' ? <PlanView /> : <ElevationView />}

          {/* view toggle */}
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 gap-1 rounded-full bg-white/90 p-1 shadow-card">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  view === v.id ? 'bg-hds-black text-white' : 'text-hds-muted hover:text-hds-black'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
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
