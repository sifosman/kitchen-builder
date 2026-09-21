import { useState } from 'react'
import { useStore } from '../store'
import { CABINET_LIBRARY, getModule } from '../data/cabinetLibrary'
import { validateLayout } from '../engine/rules'

const KIND_GROUPS: Record<string, string[]> = {
  base: ['B300', 'B450', 'B600', 'B900', 'D450', 'D600', 'D900'],
  drawer: ['D450', 'D600', 'D900', 'B300', 'B450', 'B600', 'B900'],
  sink: ['SINK600', 'SINK900', 'SINK1000'],
  wall: ['W300', 'W450', 'W600', 'W900'],
  tall: ['T450', 'T600'],
  oven: ['OVEN600'],
  filler: ['F50', 'F80', 'F100'],
  fridge: ['FRIDGE600', 'FRIDGE900'],
  hob: ['HOB600'],
  dishwasher: ['DW600'],
}

export default function UnitEditor() {
  const { units, selectedUnitId, selectUnit, swapUnitModule, nudgeUnit, removeUnit, room, setUnitWidth } = useStore()
  const unit = units.find(u => u.instanceId === selectedUnitId)
  const violations = validateLayout(units, room)

  return (
    <div className="space-y-3">
      {unit ? (
        <div className="rounded-xl border-2 border-hds-gold bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-hds-black">{getModule(unit.moduleId).name}</span>
            <button onClick={() => selectUnit(null)} className="text-xs font-medium text-hds-muted hover:text-hds-black">Done</button>
          </div>
          <p className="text-xs text-hds-muted">
            {unit.wallId === 'A' ? 'Back' : unit.wallId === 'B' ? 'Left' : 'Right'} wall · starts at {unit.startMm}mm · {unit.widthMm}mm wide
          </p>
          <div>
            <label className="hds-label">Swap unit</label>
            <select
              value={unit.moduleId}
              onChange={e => swapUnitModule(unit.instanceId, e.target.value)}
              className="hds-input"
            >
              {(KIND_GROUPS[unit.kind] ?? [unit.moduleId]).map(id => (
                <option key={id} value={id}>{getModule(id).name}</option>
              ))}
            </select>
          </div>
          {['base', 'drawer', 'wall', 'tall'].includes(unit.kind) && (
            <div>
              <label className="hds-label">Width (mm)</label>
              <input
                type="number"
                step={10}
                min={unit.kind === 'tall' ? 300 : 300}
                max={unit.kind === 'tall' ? 600 : 1000}
                value={unit.widthMm}
                onChange={e => {
                  const w = Number(e.target.value)
                  const max = unit.kind === 'tall' ? 600 : 1000
                  if (w >= 300 && w <= max) setUnitWidth(unit.instanceId, w)
                }}
                className="hds-input"
              />
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-hds-muted">Move</span>
            {[-100, -50, 50, 100].map(d => (
              <button
                key={d}
                onClick={() => nudgeUnit(unit.instanceId, d)}
                className="rounded-lg border border-hds-border bg-white px-2.5 py-1.5 text-xs font-medium text-hds-black transition-colors hover:border-hds-gold"
              >
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
            <button
              onClick={() => removeUnit(unit.instanceId)}
              className="ml-auto rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-hds-border bg-hds-sand/60 p-4">
          <p className="mb-3 text-sm text-hds-muted">Tap a cabinet in the 3D view to fine-tune it, or add one:</p>
          <AddUnitRow />
        </div>
      )}

      {violations.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 text-sm font-semibold text-amber-800">Heads up — a few things need attention</p>
          <ul className="space-y-0.5 text-xs text-amber-700">
            {violations.slice(0, 6).map((v, i) => <li key={i}>• {v}</li>)}
            {violations.length > 6 && <li>…and {violations.length - 6} more</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

function AddUnitRow() {
  const { room, addUnit } = useStore()
  const addable = CABINET_LIBRARY.filter(m => !['fridge', 'hob', 'dishwasher'].includes(m.kind))
  const [moduleId, setModuleId] = useState(addable[0]?.id ?? '')
  const [wallId, setWallId] = useState(room.walls[0]?.id ?? '')

  const wallExists = room.walls.some(w => w.id === wallId)
  const effectiveWall = wallExists ? wallId : (room.walls[0]?.id ?? '')

  return (
    <div className="flex gap-2">
      <select value={moduleId} onChange={e => setModuleId(e.target.value)} className="hds-input flex-1 text-sm">
        {addable.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select value={effectiveWall} onChange={e => setWallId(e.target.value)} className="hds-input w-24 text-sm">
        {room.walls.map(w => <option key={w.id} value={w.id}>Wall {w.id}</option>)}
      </select>
      <button
        onClick={() => addUnit(moduleId, effectiveWall)}
        className="rounded-lg bg-hds-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
      >
        Add
      </button>
    </div>
  )
}
