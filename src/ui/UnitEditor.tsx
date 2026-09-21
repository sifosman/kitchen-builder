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
  const { units, selectedUnitId, selectUnit, swapUnitModule, nudgeUnit, removeUnit, room, addUnit } = useStore()
  const unit = units.find(u => u.instanceId === selectedUnitId)
  const violations = validateLayout(units, room)

  return (
    <div className="space-y-3">
      {unit ? (
        <div className="border border-amber-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-400">{getModule(unit.moduleId).name}</span>
            <button onClick={() => selectUnit(null)} className="text-gray-500 hover:text-gray-300 text-xs">close</button>
          </div>
          <div className="text-xs text-gray-400">
            Wall {unit.wallId} · starts at {unit.startMm}mm · {unit.widthMm}mm wide
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Swap module</label>
            <select
              value={unit.moduleId}
              onChange={e => swapUnitModule(unit.instanceId, e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
            >
              {(KIND_GROUPS[unit.kind] ?? [unit.moduleId]).map(id => (
                <option key={id} value={id}>{getModule(id).name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 mr-1">Move</label>
            {[-100, -50, 50, 100].map(d => (
              <button key={d} onClick={() => nudgeUnit(unit.instanceId, d)} className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-xs">
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
            <button onClick={() => removeUnit(unit.instanceId)} className="ml-auto px-2 py-1 bg-red-900/60 hover:bg-red-800 rounded text-xs text-red-200">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Click a unit in the 3D view to edit it, or add one:</p>
          <AddUnitRow />
        </div>
      )}

      {violations.length > 0 && (
        <div className="border border-red-900/60 bg-red-950/30 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-400 mb-1">Rule violations</p>
          <ul className="text-xs text-red-300/80 space-y-0.5">
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
  return (
    <div className="flex gap-1">
      <select id="add-module" className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs">
        {addable.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select id="add-wall" className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs">
        {room.walls.map(w => <option key={w.id} value={w.id}>Wall {w.id}</option>)}
      </select>
      <button
        onClick={() => {
          const mod = (document.getElementById('add-module') as HTMLSelectElement).value
          const wall = (document.getElementById('add-wall') as HTMLSelectElement).value
          addUnit(mod, wall)
        }}
        className="px-2 py-1 bg-amber-600 hover:bg-amber-500 rounded text-xs text-white"
      >
        Add
      </button>
    </div>
  )
}
