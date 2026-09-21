import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useStore } from '../store'
import { findDoorMaterial, CARCASS_BOARD } from '../data/boardMaterials'
import EdgeTicks from './EdgeTicks'

interface Label {
  key: string
  pieceId: string
  cabinetRef: string
  part: string
  dims: string
  materialName: string
  edging: string
  n: number
  total: number
}

/** Printable QR labels — one per panel, 3 per row, A4. */
export default function LabelSheet() {
  const store = useStore()
  const [qrs, setQrs] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)

  // fresh tab → store is empty; fall back to the design handed over via
  // localStorage by the "Print labels" button
  const handedOver = useMemo(() => {
    try {
      const raw = localStorage.getItem('hds-labels')
      return raw ? (JSON.parse(raw) as { bom: typeof store.bom; doorMaterialId: string; designId: string }) : null
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bom = store.bom ?? handedOver?.bom ?? null
  const doorMaterialId = store.bom ? store.doorMaterialId : handedOver?.doorMaterialId ?? store.doorMaterialId
  const designId = store.bom ? store.designId : handedOver?.designId ?? store.designId

  const doorName = findDoorMaterial(doorMaterialId)?.name ?? 'Door board'

  const labels = useMemo<Label[]>(() => {
    if (!bom) return []
    const out: Label[] = []
    bom.lines.forEach((l, li) => {
      for (let n = 0; n < l.qty; n++) {
        out.push({
          key: `${li}-${n}`,
          pieceId: `${li}-${n}`,
          cabinetRef: l.instanceId,
          part: `${l.part} — ${l.moduleName}`,
          dims: `${l.lengthMm} × ${l.widthMm} mm`,
          materialName: l.material === 'carcass' ? CARCASS_BOARD.name : l.material === 'door' ? doorName : 'Backer board',
          edging: l.edging,
          n: 0,
          total: 0,
        })
      }
    })
    out.forEach((l, i) => {
      l.n = i + 1
      l.total = out.length
    })
    return out
  }, [bom, doorName])

  useEffect(() => {
    let live = true
    Promise.all(
      labels.map(async l => [l.key, await QRCode.toString(`HDS|${designId}|${l.pieceId}`, { type: 'svg', margin: 0, width: 96 })] as const),
    ).then(entries => {
      if (!live) return
      setQrs(Object.fromEntries(entries))
      setReady(true)
    })
    return () => {
      live = false
    }
  }, [labels, designId])

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [ready])

  return (
    <div className="label-sheet bg-white p-4">
      <style>{`
        .label-card .qr svg { width: 100%; height: 100%; }
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: #fff !important; }
          .label-sheet { padding: 0 !important; }
          .label-card { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>
      <div className="grid grid-cols-3 gap-[4mm]">
        {labels.map(l => (
          <div key={l.key} className="label-card flex h-[36mm] w-[70mm] items-stretch rounded border border-neutral-300 bg-white">
            {/* QR — fixed 22mm square with 2mm margin */}
            <div className="m-[2mm] h-[22mm] w-[22mm] shrink-0">
              {qrs[l.key] ? (
                <span dangerouslySetInnerHTML={{ __html: qrs[l.key] }} className="qr block h-full w-full" />
              ) : (
                <span className="block h-full w-full rounded bg-neutral-100" />
              )}
            </div>
            {/* text column */}
            <div className="flex min-w-0 flex-1 flex-col justify-between py-[2mm] pr-[2mm]">
              <div>
                <div className="flex items-center gap-1">
                  <img src="/images/hds-logo.webp" alt="HDS" className="h-3 w-3 rounded-sm object-contain" />
                  <span className="text-[8px] font-semibold tracking-wide text-neutral-500">HDS · {l.cabinetRef}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-neutral-900">{l.part}</p>
                <p className="text-[12px] font-bold leading-tight text-neutral-900">{l.dims}</p>
                <p className="truncate text-[8px] text-neutral-600">{l.materialName}</p>
              </div>
              <div className="flex items-center justify-between">
                <EdgeTicks edging={l.edging} size={18} />
                <span className="text-[7px] text-neutral-500">Panel {l.n} / {l.total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {labels.length === 0 && <p className="text-sm text-neutral-500">No panels to label — design a kitchen first.</p>}
    </div>
  )
}
