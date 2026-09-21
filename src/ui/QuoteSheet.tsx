import { useStore } from '../store'
import { findDoorMaterial } from '../data/boardMaterials'
import { requestQuote } from '../api/optimizerClient'
import { requestMockQuote, useMockApi } from '../api/mockClient'
import { validateLayout } from '../engine/rules'

const fmt = (n?: number) => (n === undefined ? '—' : `R${Math.round(n).toLocaleString('en-ZA')}`)

const TIER_LABELS = { value: 'Value', standard: 'Standard', premium: 'Premium' } as const
const SHAPE_LABELS = { straight: 'Straight', 'l-shape': 'L-shape', 'u-shape': 'U-shape' } as const

export default function QuoteSheet() {
  const { bom, tier, doorMaterialId, customer, setCustomer, quote, setQuote, units, room, estimate } = useStore()
  const mock = useMockApi()
  const violations = validateLayout(units, room)
  const doorMat = findDoorMaterial(doorMaterialId)
  const cabinetCount = units.filter(u => !['filler', 'fridge', 'hob', 'dishwasher'].includes(u.kind)).length

  const generate = async () => {
    if (!bom || bom.lines.length === 0) return
    if (!doorMat) return
    setQuote({ status: 'sending', result: null })
    try {
      const fn = mock ? requestMockQuote : requestQuote
      const result = await fn(bom, doorMat, tier, customer)
      setQuote({ status: result.success ? 'done' : 'error', result })
    } catch (e: any) {
      setQuote({ status: 'error', result: { success: false, message: e?.message || 'Request failed' } })
    }
  }

  const done = quote.status === 'done' && quote.result?.success

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-hds-black">Your quote</h2>
        <p className="mt-1 text-sm text-hds-muted">One last step — tell us where to send your quote.</p>
      </div>

      {/* summary card */}
      <div className="rounded-2xl border border-hds-border bg-hds-sand/60 p-4 text-sm">
        <div className="flex justify-between py-1"><span className="text-hds-muted">Room</span><span className="font-medium text-hds-black">{SHAPE_LABELS[room.shape]} · {room.walls.map(w => `${w.lengthMm}mm`).join(' + ')}</span></div>
        <div className="flex justify-between py-1"><span className="text-hds-muted">Cabinets</span><span className="font-medium text-hds-black">{cabinetCount}</span></div>
        <div className="flex justify-between py-1"><span className="text-hds-muted">Range</span><span className="font-medium text-hds-black">{TIER_LABELS[tier]}</span></div>
        <div className="flex items-center justify-between py-1">
          <span className="text-hds-muted">Door colour</span>
          <span className="flex items-center gap-2 font-medium text-hds-black">
            {doorMat && (
              <span className="h-5 w-5 overflow-hidden rounded-md border border-hds-border" style={{ backgroundColor: doorMat.hex }}>
                {doorMat.renderTexture && <img src={doorMat.renderTexture} alt="" className="h-full w-full object-cover" />}
              </span>
            )}
            {doorMat?.name ?? '—'}
          </span>
        </div>
        <div className="mt-1 flex justify-between border-t border-hds-border pt-2">
          <span className="font-medium text-hds-black">Estimated total (VAT incl)</span>
          <span className="font-semibold text-hds-black">{fmt(estimate?.total)}</span>
        </div>
      </div>

      {!done && (
        <>
          <div className="space-y-3">
            <div>
              <label className="hds-label">Your name</label>
              <input
                placeholder="e.g. Thandi Nkosi"
                value={customer.name}
                onChange={e => setCustomer({ name: e.target.value })}
                className="hds-input"
              />
            </div>
            <div>
              <label className="hds-label">WhatsApp number</label>
              <input
                placeholder="e.g. 0821234567"
                value={customer.phone}
                onChange={e => setCustomer({ phone: e.target.value })}
                className="hds-input"
              />
            </div>
            <div>
              <label className="hds-label">Project / suburb</label>
              <input
                placeholder="e.g. Sandton renovation"
                value={customer.project}
                onChange={e => setCustomer({ project: e.target.value })}
                className="hds-input"
              />
            </div>
          </div>

          <p className="text-center text-xs text-hds-muted">No obligation · Quote PDF sent to you · HDS branch fits &amp; delivers</p>

          <button
            onClick={generate}
            disabled={!bom || bom.lines.length === 0 || quote.status === 'sending' || violations.length > 0}
            className="hds-btn-gold"
          >
            {quote.status === 'sending' ? 'Sending…' : 'Send me my quote'}
          </button>
          {violations.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              Your layout needs a few tweaks before we can quote — go back to step 2 to fix the flagged items.
            </div>
          )}
          {mock && (
            <p className="text-center text-[11px] text-hds-muted/70">
              Demo mode — no live API call. Set VITE_MOCK_API=false for the live optimizer.
            </p>
          )}
        </>
      )}

      {done && quote.result && (
        <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
          <p className="text-base font-semibold text-emerald-900">Your quote is on its way</p>
          <div className="flex justify-between"><span className="text-emerald-800/70">Quote number</span><span className="font-mono font-medium text-emerald-900">{quote.result.quoteId}</span></div>
          <div className="flex justify-between"><span className="text-emerald-800/70">Total (VAT incl)</span><span className="font-semibold text-emerald-900">{fmt(quote.result.finalTotal)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-emerald-800/60">Cutting fee</span><span className="text-emerald-900">{fmt(quote.result.totalCuttingFee)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-emerald-800/60">Edging</span><span className="text-emerald-900">{fmt(quote.result.totalEdgingCost)}</span></div>
          <div className="flex flex-col gap-1 pt-2">
            {quote.result.quotePdfUrl && quote.result.quotePdfUrl !== '#mock-quote-pdf' && (
              <a href={quote.result.quotePdfUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-emerald-700 underline">Download quote PDF</a>
            )}
            {quote.result.cutlistPdfUrl && quote.result.cutlistPdfUrl !== '#mock-cutlist-pdf' && (
              <a href={quote.result.cutlistPdfUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-emerald-700 underline">Download cut list PDF</a>
            )}
          </div>
          {mock && <p className="pt-1 text-[11px] text-emerald-800/50">Demo mode — no live API call was made.</p>}
        </div>
      )}
      {quote.status === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {quote.result?.message || 'Something went wrong — please try again.'}
          {quote.result?.error && <div className="mt-1 text-xs text-red-500">{quote.result.error}</div>}
        </div>
      )}
    </div>
  )
}
