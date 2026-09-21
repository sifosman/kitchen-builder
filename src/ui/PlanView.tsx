import { useRef } from 'react'
import { useStore } from '../store'
import { getModule } from '../data/cabinetLibrary'
import { findDoorMaterial } from '../data/boardMaterials'
import type { PlacedUnit } from '../engine/rules'
import type { Wall } from '../engine/room'

const GOLD = '#FFC400'
const INK = '#141414'
const MUTED = '#5A5A5A'

/** Download the given SVG element as a .svg file. */
export function downloadSvg(el: SVGSVGElement | null, filename: string) {
  if (!el) return
  const blob = new Blob([new XMLSerializer().serializeToString(el)], { type: 'image/svg+xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Short drawing code — never the long module name. */
function shortCode(u: PlacedUnit): string {
  switch (u.kind) {
    case 'sink': return 'SINK'
    case 'oven': case 'hob': return 'OVEN'
    case 'fridge': return 'FRIDGE'
    case 'dishwasher': return 'DW'
    case 'filler': return 'F'
    default: return u.moduleId // B550 / D500 / W1000 / T600 — already short
  }
}

/** rough proportional estimate of rendered label width in mm */
const textW = (text: string, fontSize: number) => text.length * fontSize * 0.62

/**
 * Top-down plan. Mirrors KitchenScene3D exactly: wall A along the top,
 * wall B down the left, wall C down the right.
 */
export default function PlanView() {
  const { room, units, selectedUnitId, selectUnit, doorMaterialId } = useStore()
  const doorMat = findDoorMaterial(doorMaterialId)
  const svgRef = useRef<SVGSVGElement>(null)

  const wallA = room.walls[0]?.lengthMm ?? 3600
  const roomZ = Math.max(room.walls[1]?.lengthMm ?? 2400, room.walls[2]?.lengthMm ?? 2400)
  const T = 100 // wall band thickness
  const pad = 400
  const W = wallA + pad * 2
  const H = roomZ + pad * 2 + T

  // text scales with the drawing (viewBox is in mm)
  const fsUnit = Math.round(wallA * 0.012)
  const fsDim = Math.round(wallA * 0.016)
  const fsSmall = Math.round(wallA * 0.013)

  const unitLabel = (u: PlacedUnit, availMm: number) => {
    const code = shortCode(u)
    return textW(code, fsUnit) <= availMm ? code : ''
  }

  const fillFor = (u: PlacedUnit): { fill: string; dash?: string } => {
    if (['fridge', 'hob', 'dishwasher', 'oven'].includes(u.kind)) return { fill: 'url(#hatch)' }
    if (u.kind === 'tall' || u.mounted === 'tall') return { fill: '#4A4A4A' }
    if (u.mounted === 'wall') return { fill: 'rgba(255,255,255,0.25)', dash: '30 18' }
    if (u.kind === 'filler') return { fill: '#D6D0C6' }
    return { fill: doorMat?.hex ?? '#ccc' }
  }

  const renderUnit = (u: PlacedUnit, wi: number) => {
    const m = getModule(u.moduleId)
    const depth = u.mounted === 'wall' ? 300 : m.depthMm
    let x: number, y: number, w: number, d: number
    if (wi === 0) { x = u.startMm; y = T; w = u.widthMm; d = depth }
    else if (wi === 1) { x = T; y = u.startMm; w = depth; d = u.widthMm }
    else { x = wallA - depth; y = u.startMm; w = depth; d = u.widthMm }

    const sel = selectedUnitId === u.instanceId
    const { fill, dash } = fillFor(u)
    // for B/C walls the label is rotated — available width is the unit's depth
    const avail = wi === 0 ? w - 30 : d - 30
    const label = unitLabel(u, avail)
    const cx = x + w / 2
    const cy = y + d / 2
    return (
      <g key={u.instanceId} onClick={() => selectUnit(u.instanceId)} className="cursor-pointer">
        <rect
          x={x} y={y} width={w} height={d}
          fill={fill}
          stroke={sel ? GOLD : INK}
          strokeWidth={sel ? 18 : 8}
          strokeDasharray={dash}
        />
        {u.mounted === 'base' && u.widthMm > 600 && (
          wi === 0
            ? <line x1={cx} y1={y + 6} x2={cx} y2={y + d - 6} stroke={INK} strokeWidth={5} />
            : <line x1={x + 6} y1={cy} x2={x + w - 6} y2={cy} stroke={INK} strokeWidth={5} />
        )}
        {u.kind === 'sink' && (
          <ellipse cx={cx} cy={cy} rx={Math.min(w, d) * 0.3} ry={Math.min(w, d) * 0.22} fill="none" stroke={INK} strokeWidth={8} />
        )}
        {label && (
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={fsUnit} fill={u.mounted === 'tall' || u.kind === 'tall' ? '#fff' : INK}
            transform={wi === 0 ? undefined : `rotate(${wi === 1 ? -90 : 90} ${cx} ${cy})`}
          >
            {label}
          </text>
        )}
      </g>
    )
  }

  const dimChain = (wall: Wall, wi: number) => {
    const onWall = units
      .filter(u => u.wallId === wall.id && u.mounted !== 'wall')
      .sort((a, b) => a.startMm - b.startMm)
    const parts: JSX.Element[] = []
    const tick = 60

    // per-unit chain: 250mm below (A) / beside (B,C) the base run
    for (const u of onWall) {
      const label = `${u.widthMm}`
      if (wi === 0) {
        const y = T + 600 + 250
        parts.push(
          <g key={u.instanceId}>
            <line x1={u.startMm} y1={y} x2={u.startMm + u.widthMm} y2={y} stroke={MUTED} strokeWidth={4} />
            <line x1={u.startMm} y1={y - tick / 2} x2={u.startMm} y2={y + tick / 2} stroke={MUTED} strokeWidth={4} />
            <line x1={u.startMm + u.widthMm} y1={y - tick / 2} x2={u.startMm + u.widthMm} y2={y + tick / 2} stroke={MUTED} strokeWidth={4} />
            <text x={u.startMm + u.widthMm / 2} y={y + fsSmall * 1.3} fontSize={fsSmall} textAnchor="middle" fill={MUTED}>{label}</text>
          </g>,
        )
      } else {
        const x = wi === 1 ? T + 600 + 250 : wallA - 600 - 250
        const cy = u.startMm + u.widthMm / 2
        parts.push(
          <g key={u.instanceId}>
            <line x1={x} y1={u.startMm} x2={x} y2={u.startMm + u.widthMm} stroke={MUTED} strokeWidth={4} />
            <line x1={x - tick / 2} y1={u.startMm} x2={x + tick / 2} y2={u.startMm} stroke={MUTED} strokeWidth={4} />
            <line x1={x - tick / 2} y1={u.startMm + u.widthMm} x2={x + tick / 2} y2={u.startMm + u.widthMm} stroke={MUTED} strokeWidth={4} />
            <text x={x + fsSmall} y={cy} fontSize={fsSmall} textAnchor="middle" fill={MUTED} transform={`rotate(-90 ${x + fsSmall} ${cy})`}>{label}</text>
          </g>,
        )
      }
    }

    // overall dim: north of wall A, left of B, right of C
    const overall = `${wall.lengthMm}`
    if (wi === 0) {
      parts.push(
        <g key="overall">
          <line x1={0} y1={T / 2} x2={wall.lengthMm} y2={T / 2} stroke={MUTED} strokeWidth={5} />
          <line x1={0} y1={T / 2 - tick} x2={0} y2={T / 2 + tick} stroke={MUTED} strokeWidth={5} />
          <line x1={wall.lengthMm} y1={T / 2 - tick} x2={wall.lengthMm} y2={T / 2 + tick} stroke={MUTED} strokeWidth={5} />
          <text x={wall.lengthMm / 2} y={T / 2 - fsDim * 0.4} fontSize={fsDim} fontWeight={600} textAnchor="middle" fill={INK}>{overall}</text>
        </g>,
      )
    } else {
      const x = wi === 1 ? T / 2 : wallA + T / 2
      parts.push(
        <g key="overall">
          <line x1={x} y1={0} x2={x} y2={wall.lengthMm} stroke={MUTED} strokeWidth={5} />
          <line x1={x - tick} y1={0} x2={x + tick} y2={0} stroke={MUTED} strokeWidth={5} />
          <line x1={x - tick} y1={wall.lengthMm} x2={x + tick} y2={wall.lengthMm} stroke={MUTED} strokeWidth={5} />
          <text x={x - fsDim * 0.6} y={wall.lengthMm / 2} fontSize={fsDim} fontWeight={600} textAnchor="middle" fill={INK} transform={`rotate(-90 ${x - fsDim * 0.6} ${wall.lengthMm / 2})`}>{overall}</text>
        </g>,
      )
    }
    return parts
  }

  return (
    <div className="relative h-full w-full bg-[#D8D1C6] lg:absolute lg:bottom-[150px] lg:left-[440px] lg:right-6 lg:top-24 lg:h-auto lg:w-auto">
      <svg ref={svgRef} viewBox={`${-pad} ${-pad} ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="hatch" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="120" height="120" fill="#C9CDD2" />
            <line x1="0" y1="0" x2="0" y2="120" stroke="#7A7E83" strokeWidth="20" />
          </pattern>
        </defs>

        {/* floor area */}
        <rect x={T} y={T} width={wallA - 2 * T} height={roomZ - T} fill="#EDE7DD" stroke="none" />

        {/* walls: A top, B left, C right — same layout as the 3D scene */}
        {room.walls.map((wall, wi) => {
          const band =
            wi === 0 ? { x: 0, y: 0, w: wall.lengthMm, h: T }
            : wi === 1 ? { x: 0, y: 0, w: T, h: wall.lengthMm }
            : { x: wallA, y: 0, w: T, h: wall.lengthMm }
          return (
            <g key={wall.id}>
              <rect {...band} fill="#E3DDD3" stroke={INK} strokeWidth={10} />
              {wall.obstructions.filter(o => o.kind === 'door' || o.kind === 'window').map(o => (
                <rect
                  key={o.id}
                  x={wi === 0 ? o.offsetMm : band.x} y={wi === 0 ? band.y : o.offsetMm}
                  width={wi === 0 ? o.widthMm : T} height={wi === 0 ? T : o.widthMm}
                  fill={o.kind === 'window' ? '#BEE3F8' : '#C9B08A'}
                />
              ))}
              {dimChain(wall, wi)}
            </g>
          )
        })}

        {/* worktop outline over base runs */}
        {room.walls.map((wall, wi) => {
          const base = units.filter(u => u.wallId === wall.id && u.mounted === 'base')
          if (base.length === 0) return null
          const s = Math.min(...base.map(u => u.startMm))
          const e = Math.max(...base.map(u => u.startMm + u.widthMm))
          const depth = 600
          const r =
            wi === 0 ? { x: s, y: T, w: e - s, h: depth }
            : wi === 1 ? { x: T, y: s, w: depth, h: e - s }
            : { x: wallA - depth, y: s, w: depth, h: e - s }
          return <rect key={wall.id} {...r} fill="none" stroke="#3A3A3A" strokeWidth={8} strokeDasharray="40 20" />
        })}

        {units.map(u => {
          const wi = room.walls.findIndex(w => w.id === u.wallId)
          return wi < 0 ? null : renderUnit(u, wi)
        })}
      </svg>

      <button
        onClick={() => downloadSvg(svgRef.current, 'kitchen-plan.svg')}
        className="absolute bottom-4 right-4 rounded-full border border-hds-border bg-white/90 px-4 py-2 text-xs font-medium text-hds-black shadow-card transition-colors hover:bg-white"
      >
        Download drawing (SVG)
      </button>
    </div>
  )
}
