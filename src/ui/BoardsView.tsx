import { useState } from 'react'
import { useStore } from '../store'
import { findDoorMaterial, CARCASS_BOARD } from '../data/boardMaterials'
import type { NestedBoard } from '../engine/nest'

const MATERIAL_ORDER = ['carcass', 'door', 'back'] as const
const MATERIAL_HEADING = {
  carcass: () => `Carcass board — ${CARCASS_BOARD.name}`,
  door: (name: string) => `Door board — ${name}`,
  back: () => 'Backing board — 3mm MDF',
} as const

function BoardSvg({ board, index }: { board: NestedBoard; index: number }) {
  const L = board.sheetLengthMm
  const W = board.sheetWidthMm
  return (
    <svg viewBox={`-40 -40 ${L + 80} ${W + 80}`} className="w-full rounded-lg border border-hds-border bg-[#EDE7DD]">
      <defs>
        <pattern id={`offhatch-${index}`} width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="80" height="80" fill="#D9D4CB" />
          <line x1="0" y1="0" x2="0" y2="80" stroke="#B8B2A8" strokeWidth="10" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={L} height={W} fill="#F4F1EC" stroke="#141414" strokeWidth={12} />
      {board.offcuts.map((o, i) => (
        <g key={i}>
          <rect
            x={o.x} y={o.y} width={o.w} height={o.l}
            fill={o.recoverable ? '#DCEDC8' : `url(#offhatch-${index})`}
            stroke="#9A958C" strokeWidth={6}
          />
          {o.w > 500 && o.l > 250 && (
            <text x={o.x + o.w / 2} y={o.y + o.l / 2} fontSize={90} textAnchor="middle" dominantBaseline="middle" fill="#5A5A5A">
              {`off-cut ${Math.round(o.w)}×${Math.round(o.l)}`}
            </text>
          )}
        </g>
      ))}
      {board.placements.map(p => {
        const l = p.rotated ? p.widthMm : p.lengthMm
        const w = p.rotated ? p.lengthMm : p.widthMm
        return (
          <g key={p.id}>
            <rect x={p.x} y={p.y} width={l} height={w} fill="#FBFAF7" stroke="#141414" strokeWidth={8} />
            {l > 400 && w > 160 && (
              <text x={p.x + l / 2} y={p.y + w / 2} fontSize={85} textAnchor="middle" dominantBaseline="middle" fill="#141414">
                {`${p.part} ${p.lengthMm}×${p.widthMm}${p.rotated ? ' ↻' : ''}`}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Step-4 tab: nested boards with placements, off-cuts and yield. */
export default function BoardsView() {
  const { nest, doorMaterialId } = useStore()
  const [zoom, setZoom] = useState<number | null>(null)
  const doorName = findDoorMaterial(doorMaterialId)?.name ?? 'Door'

  if (!nest || nest.boards.length === 0) {
    return <p className="text-sm text-hds-muted">No boards yet — design a layout first.</p>
  }

  const recoverable = nest.boards.reduce((s, b) => s + b.offcuts.filter(o => o.recoverable).length, 0)
  const totalUsed = nest.boards.reduce((s, b) => s + b.usedAreaMm2, 0)
  const totalArea = nest.boards.reduce((s, b) => s + b.sheetLengthMm * b.sheetWidthMm, 0)
  const wastePct = Math.round((1 - totalUsed / totalArea) * 100)

  let boardIndex = -1

  return (
    <div className="space-y-5">
      {MATERIAL_ORDER.map(mat => {
        const boards = nest.boards.filter(b => b.material === mat)
        if (boards.length === 0) return null
        const stats = nest.byMaterial[mat]
        const heading =
          mat === 'carcass' ? MATERIAL_HEADING.carcass()
          : mat === 'door' ? MATERIAL_HEADING.door(doorName)
          : MATERIAL_HEADING.back()
        const matRecoverable = boards.reduce((s, b) => s + b.offcuts.filter(o => o.recoverable).length, 0)
        const matWaste = Math.round(100 - stats.yieldPct)
        return (
          <div key={mat}>
            <p className="mb-1 text-sm font-semibold text-hds-black">
              {heading} · {stats.boards} sheet{stats.boards === 1 ? '' : 's'} · {Math.round(stats.yieldPct)}% yield
            </p>
            <p className="mb-2 text-xs text-hds-muted">
              Recoverable off-cuts: {matRecoverable} · Waste: {matWaste}%
            </p>
            <div className="space-y-2">
              {boards.map(b => {
                boardIndex++
                const idx = boardIndex
                return (
                  <button key={idx} onClick={() => setZoom(idx)} className="block w-full" title="Click to enlarge">
                    <BoardSvg board={b} index={idx} />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="rounded-xl border border-hds-border bg-hds-sand/60 px-4 py-3 text-xs text-hds-muted">
        <span className="font-semibold text-hds-black">Recoverable off-cuts: {recoverable}</span> · Waste: {wastePct}%
      </p>

      {zoom !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setZoom(null)}>
          <div className="max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-float" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-hds-black">Board {zoom + 1}</p>
              <button onClick={() => setZoom(null)} className="text-sm text-hds-muted hover:text-hds-black">Close ✕</button>
            </div>
            <BoardSvg board={nest.boards[zoom]} index={zoom} />
          </div>
        </div>
      )}
    </div>
  )
}
