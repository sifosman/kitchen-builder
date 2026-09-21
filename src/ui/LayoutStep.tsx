import { useStore } from '../store'
import { getModule } from '../data/cabinetLibrary'
import { findDoorMaterial } from '../data/boardMaterials'
import { buildBom } from '../engine/bom'
import { priceKitchen } from '../engine/pricing'
import type { PlacedUnit } from '../engine/rules'
import type { Wall } from '../engine/room'
import UnitEditor from './UnitEditor'

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`
const OPTION_NAMES = ['A', 'B', 'C']

function unitColor(u: PlacedUnit): { fill: string; stroke?: string; dash?: string } {
  if (['fridge', 'hob', 'dishwasher', 'oven'].includes(u.kind)) {
    return { fill: '#FFFFFF', stroke: '#6B6B6B', dash: '3 2' }
  }
  if (u.mounted === 'tall' || u.kind === 'tall') return { fill: '#4A4A4A' }
  if (u.mounted === 'wall') return { fill: '#D9D5CE' }
  if (u.kind === 'filler') return { fill: '#EFEBE4' }
  return { fill: '#A8A49C' }
}

/** Tiny 2D plan strip: base-level band + wall-unit band per wall. */
function PlanStrip({ units, walls }: { units: PlacedUnit[]; walls: Wall[] }) {
  const W = 320
  const bandH = 16
  const gap = 4
  const pad = 4
  const H = walls.length * (bandH * 2 + gap + 10) + pad * 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" aria-hidden>
      {walls.map((wall, wi) => {
        const y0 = pad + wi * (bandH * 2 + gap + 10)
        const scale = W / Math.max(wall.lengthMm, 1)
        const onWall = units.filter(u => u.wallId === wall.id)
        const floor = onWall.filter(u => u.mounted !== 'wall')
        const hung = onWall.filter(u => u.mounted === 'wall')
        return (
          <g key={wall.id}>
            <text x={0} y={y0 + 8} fontSize="8" fill="#6B6B6B">{`Wall ${wall.id}`}</text>
            {hung.map(u => {
              const c = unitColor(u)
              return (
                <rect
                  key={u.instanceId}
                  x={u.startMm * scale}
                  y={y0}
                  width={Math.max(u.widthMm * scale, 1)}
                  height={bandH - 4}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeDasharray={c.dash}
                  rx={1.5}
                />
              )
            })}
            {floor.map(u => {
              const c = unitColor(u)
              return (
                <rect
                  key={u.instanceId}
                  x={u.startMm * scale}
                  y={y0 + bandH + gap - 4}
                  width={Math.max(u.widthMm * scale, 1)}
                  height={bandH}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeDasharray={c.dash}
                  rx={1.5}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

export default function LayoutStep() {
  const { proposals, selectedProposalId, selectProposal, units, room, tier, doorMaterialId, setStep } = useStore()
  const doorMat = findDoorMaterial(doorMaterialId)

  const priceFor = (p: { units: PlacedUnit[] }) => {
    if (!doorMat) return null
    try {
      return priceKitchen(buildBom(p.units), doorMat, tier).total
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-hds-black">Pick a layout</h2>
        <p className="mt-1 text-sm text-hds-muted">We've drawn up a few options that fit your room. Pick one to make it yours.</p>
      </div>

      <div className="space-y-3">
        {proposals.map((p, i) => {
          const total = priceFor(p)
          const selected = selectedProposalId === p.id
          return (
            <button
              key={p.id}
              onClick={() => selectProposal(p.id)}
              className={`w-full rounded-2xl border-2 bg-white p-4 text-left transition-colors ${
                selected ? 'border-hds-gold shadow-card' : 'border-hds-border hover:border-hds-gold/60'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-hds-black">
                  Option {OPTION_NAMES[i] ?? p.id}
                  {i === 0 && <span className="ml-2 rounded-full bg-hds-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-hds-black">Best fit</span>}
                </span>
                {total !== null && <span className="text-sm font-semibold text-hds-black">{fmt(total)}</span>}
              </div>
              <p className="mt-0.5 text-xs text-hds-muted">
                {p.units.filter(u => !['filler', 'fridge', 'hob', 'dishwasher'].includes(u.kind)).length} cabinets
                {p.violations.length > 0 && <span className="text-amber-600"> · needs {p.violations.length} tweak{p.violations.length > 1 ? 's' : ''}</span>}
              </p>
              <PlanStrip units={p.units} walls={room.walls} />
              {p.notes.map((n, j) => (
                <p key={j} className="mt-1 text-[11px] text-hds-muted">{n}</p>
              ))}
            </button>
          )
        })}
      </div>

      {units.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-hds-black">Fine-tune</h3>
          <UnitEditor />
        </div>
      )}

      <button onClick={() => setStep('style')} className="hds-btn-gold">
        Choose colours →
      </button>
    </div>
  )
}
