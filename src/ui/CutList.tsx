import { useStore } from '../store'
import { findDoorMaterial, CARCASS_BOARD } from '../data/boardMaterials'
import EdgeTicks from './EdgeTicks'
import type { BomLine } from '../engine/bom'

const MATERIAL_LABEL = { carcass: 'Carcass', door: 'Door', back: 'Back' } as const

/** Step-4 tab: the full cutting list grouped by cabinet. */
export default function CutList() {
  const { bom, doorMaterialId } = useStore()
  const doorMat = findDoorMaterial(doorMaterialId)
  if (!bom || bom.lines.length === 0) {
    return <p className="text-sm text-hds-muted">No cutting list yet — design a layout first.</p>
  }

  const byCabinet = new Map<string, BomLine[]>()
  for (const l of bom.lines) {
    const key = `${l.instanceId} · ${l.moduleName}`
    if (!byCabinet.has(key)) byCabinet.set(key, [])
    byCabinet.get(key)!.push(l)
  }

  const totalPanels = bom.lines.reduce((s, l) => s + l.qty, 0)

  return (
    <div className="space-y-4">
      {[...byCabinet.entries()].map(([cab, lines]) => (
        <div key={cab} className="overflow-hidden rounded-xl border border-hds-border">
          <p className="bg-hds-sand/70 px-3 py-2 text-xs font-semibold text-hds-black">{cab}</p>
          <table className="w-full text-xs">
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-hds-border/60">
                  <td className="px-3 py-1.5 text-hds-black">{l.part}</td>
                  <td className="px-2 py-1.5 text-hds-muted">{l.qty}×</td>
                  <td className="px-2 py-1.5 font-medium text-hds-black">{l.lengthMm} × {l.widthMm}</td>
                  <td className="px-2 py-1.5 text-hds-muted">
                    {l.material === 'door' ? doorMat?.name ?? 'Door' : l.material === 'carcass' ? CARCASS_BOARD.name : 'Backer'} · {MATERIAL_LABEL[l.material]}
                  </td>
                  <td className="px-2 py-1.5"><EdgeTicks edging={l.edging} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="rounded-xl border border-hds-border bg-hds-sand/60 px-4 py-3 text-xs text-hds-muted">
        <span className="font-semibold text-hds-black">Totals:</span> {totalPanels} panels ·{' '}
        edging {bom.edgingMetres.carcass.toFixed(1)}m carcass / {bom.edgingMetres.door.toFixed(1)}m door ·{' '}
        {bom.hardware.hinges} hinges · {bom.hardware.runnerPairs} runner pairs · {bom.hardware.handles} handles ·{' '}
        {bom.hardware.legs} legs · {bom.hardware.shelfSupportPacks} shelf supports · {bom.hardware.fixings} fixings
      </div>
    </div>
  )
}
