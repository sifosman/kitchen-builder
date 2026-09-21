import { useStore } from '../store'
import { findDoorMaterial } from '../data/boardMaterials'
import { requestQuote } from '../api/optimizerClient'
import { requestMockQuote, useMockApi } from '../api/mockClient'
import { validateLayout } from '../engine/rules'

const fmt = (n?: number) => (n === undefined ? '—' : `R${Math.round(n).toLocaleString('en-ZA')}`)

export default function QuoteSheet() {
  const { bom, tier, doorMaterialId, customer, setCustomer, quote, setQuote, units, room } = useStore()
  const mock = useMockApi()
  const violations = validateLayout(units, room)

  const generate = async () => {
    if (!bom || bom.lines.length === 0) return
    const doorMat = findDoorMaterial(doorMaterialId)
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2">
        <input
          placeholder="Customer name"
          value={customer.name}
          onChange={e => setCustomer({ name: e.target.value })}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Phone (e.g. 0821234567)"
          value={customer.phone}
          onChange={e => setCustomer({ phone: e.target.value })}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Project name"
          value={customer.project}
          onChange={e => setCustomer({ project: e.target.value })}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm"
        />
      </div>

      {bom && (
        <div className="border border-neutral-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
          <div className="flex justify-between"><span>Cabinets</span><span className="text-gray-200">{bom.cabinetCount}</span></div>
          <div className="flex justify-between"><span>Cut panels</span><span className="text-gray-200">{bom.lines.reduce((s, l) => s + l.qty, 0)}</span></div>
          <div className="flex justify-between"><span>Hinges / runners / handles</span><span className="text-gray-200">{bom.hardware.hinges} / {bom.hardware.runnerPairs} / {bom.hardware.handles}</span></div>
        </div>
      )}

      <button
        onClick={generate}
        disabled={!bom || bom.lines.length === 0 || quote.status === 'sending' || violations.length > 0}
        className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-gray-500 text-white font-semibold text-sm"
      >
        {quote.status === 'sending' ? 'Generating…' : mock ? 'Generate quote (mock)' : 'Generate quote'}
      </button>
      {violations.length > 0 && (
        <p className="text-xs text-red-400">Fix layout rule violations before quoting.</p>
      )}
      {mock && (
        <p className="text-[11px] text-gray-600">
          Mock mode — no live API call. Set <code className="text-gray-400">VITE_MOCK_API=false</code> to hit the live optimizer.
        </p>
      )}

      {quote.status === 'done' && quote.result?.success && (
        <div className="border border-emerald-800 bg-emerald-950/30 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Quote</span><span className="font-mono text-emerald-300">{quote.result.quoteId}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Total (VAT incl)</span><span className="font-semibold text-white">{fmt(quote.result.finalTotal)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">Cutting fee</span><span>{fmt(quote.result.totalCuttingFee)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">Edging</span><span>{fmt(quote.result.totalEdgingCost)}</span></div>
          <div className="pt-1 flex flex-col gap-1">
            {quote.result.quotePdfUrl && quote.result.quotePdfUrl !== '#mock-quote-pdf' && (
              <a href={quote.result.quotePdfUrl} target="_blank" rel="noreferrer" className="text-emerald-400 underline text-xs">Quote PDF</a>
            )}
            {quote.result.cutlistPdfUrl && quote.result.cutlistPdfUrl !== '#mock-cutlist-pdf' && (
              <a href={quote.result.cutlistPdfUrl} target="_blank" rel="noreferrer" className="text-emerald-400 underline text-xs">Cut list PDF</a>
            )}
          </div>
        </div>
      )}
      {quote.status === 'error' && (
        <div className="border border-red-900 bg-red-950/30 rounded-lg p-3 text-xs text-red-300">
          {quote.result?.message || 'Quote failed'}
          {quote.result?.error && <div className="mt-1 text-red-400/70">{quote.result.error}</div>}
        </div>
      )}
    </div>
  )
}
