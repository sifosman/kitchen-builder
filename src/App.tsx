import { useStore } from './store'
import RoomForm from './ui/RoomForm'
import KitchenScene3D from './ui/KitchenScene3D'
import PricePanel from './ui/PricePanel'
import QuoteSheet from './ui/QuoteSheet'
import UnitEditor from './ui/UnitEditor'

export default function App() {
  const { step, proposals, selectedProposalId, selectProposal, units } = useStore()

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-200">
      <header className="border-b border-neutral-800 px-5 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-amber-600 flex items-center justify-center font-bold text-white text-sm">H</div>
        <div>
          <h1 className="text-base font-semibold text-white leading-tight">HDS Kitchen Builder</h1>
          <p className="text-xs text-gray-500">Room in → cabinets out → live price → cut list</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-4 p-4">
        {/* left: room input + proposals */}
        <div className="space-y-4">
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">1 · Room</h2>
            <RoomForm />
          </section>

          {proposals.length > 0 && (
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-2">2 · Proposed layouts</h2>
              <div className="space-y-2">
                {proposals.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProposal(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${selectedProposalId === p.id ? 'border-amber-500 bg-amber-950/30' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'}`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-200">Layout {p.id.slice(1)}</span>
                      <span className="text-xs text-gray-500">score {p.score}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.units.filter(u => !['filler', 'fridge', 'hob', 'dishwasher'].includes(u.kind)).length} cabinets
                      {p.violations.length > 0 && <span className="text-red-400"> · {p.violations.length} violations</span>}
                    </div>
                    {p.notes.map((n, i) => <div key={i} className="text-[11px] text-amber-500/80">{n}</div>)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step !== 'room' && units.length > 0 && (
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-2">Edit units</h2>
              <UnitEditor />
            </section>
          )}
        </div>

        {/* centre: 3D */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden min-h-[540px] lg:min-h-0">
          {units.length > 0 ? (
            <KitchenScene3D />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm p-8 text-center">
              Enter the room dimensions on the left and hit <em>Generate layout</em> — the proposed kitchen renders here in 3D.
            </div>
          )}
        </div>

        {/* right: price + quote */}
        <div className="space-y-4">
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">3 · Live price</h2>
            <PricePanel />
          </section>
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">4 · Quote & cut list</h2>
            <QuoteSheet />
          </section>
        </div>
      </div>
    </div>
  )
}
