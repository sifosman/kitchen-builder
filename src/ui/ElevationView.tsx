import { useRef } from 'react'
import { useStore } from '../store'
import { findDoorMaterial } from '../data/boardMaterials'
import { downloadSvg } from './PlanView'
import type { PlacedUnit } from '../engine/rules'
import type { Wall } from '../engine/room'

const GOLD = '#FFC400'
const INK = '#141414'
const MUTED = '#5A5A5A'
// vertical datums (mm above floor) — same constants as the 3D scene
const PLINTH = 150
const BASE_H = 720
const WORKTOP = 40
const WALL_BOT = 1450
const WALL_H = 720
const TALL_H = 2100

const shortCode = (u: PlacedUnit) => {
  switch (u.kind) {
    case 'sink': return 'SINK'
    case 'oven': case 'hob': return 'OVEN'
    case 'fridge': return 'FRIDGE'
    case 'dishwasher': return 'DW'
    case 'filler': return 'F'
    default: return u.moduleId
  }
}

const textW = (text: string, fontSize: number) => text.length * fontSize * 0.62

function WallElevation({ wall, ceilingMm }: { wall: Wall; ceilingMm: number }) {
  const { units, selectedUnitId, selectUnit, doorMaterialId } = useStore()
  const doorHex = findDoorMaterial(doorMaterialId)?.hex ?? '#cccccc'
  const onWall = units.filter(u => u.wallId === wall.id).sort((a, b) => a.startMm - b.startMm)
  const W = wall.lengthMm
  const H = Math.max(ceilingMm, 2400)
  const Y = (above: number) => H - above

  const fsUnit = Math.round(W * 0.011)
  const fsDim = Math.round(W * 0.014)
  const tick = 60

  const base = onWall.filter(u => u.mounted === 'base')
  const baseS = base.length ? Math.min(...base.map(u => u.startMm)) : 0
  const baseE = base.length ? Math.max(...base.map(u => u.startMm + u.widthMm)) : 0

  const renderUnit = (u: PlacedUnit) => {
    const sel = selectedUnitId === u.instanceId
    const x = u.startMm
    const w = u.widthMm
    let yTop: number, hgt: number, fill = doorHex

    if (u.mounted === 'wall') {
      yTop = Y(WALL_BOT + WALL_H); hgt = WALL_H
    } else if (u.kind === 'tall' || u.mounted === 'tall') {
      yTop = Y(TALL_H); hgt = TALL_H
    } else if (u.kind === 'fridge') {
      yTop = Y(1800); hgt = 1800; fill = 'url(#hatchE)'
    } else if (u.kind === 'oven' || u.kind === 'hob') {
      yTop = Y(PLINTH + BASE_H); hgt = BASE_H; fill = '#2A2A2A'
    } else if (u.kind === 'dishwasher') {
      yTop = Y(PLINTH + 870); hgt = 870; fill = 'url(#hatchE)'
    } else if (u.kind === 'filler') {
      yTop = Y(PLINTH + BASE_H); hgt = BASE_H; fill = '#D6D0C6'
    } else {
      yTop = Y(PLINTH + BASE_H); hgt = BASE_H
    }

    const frontCount = w <= 600 ? 1 : 2
    const isDrawer = u.kind === 'drawer'
    const stroke = sel ? GOLD : INK
    const sw = sel ? 22 : 10
    const code = shortCode(u)
    const label = textW(code, fsUnit) <= w - 30 ? code : ''

    return (
      <g key={u.instanceId} onClick={() => selectUnit(u.instanceId)} className="cursor-pointer">
        <rect x={x} y={yTop} width={w} height={hgt} fill={fill} stroke={stroke} strokeWidth={sw} />
        {/* fronts with 3mm gaps + handle marks */}
        {isDrawer
          ? [0, 1, 2].map(i => {
              const fh = hgt / 3
              return (
                <g key={i}>
                  <rect x={x + 4} y={yTop + i * fh + 4} width={w - 8} height={fh - 8} fill="none" stroke={stroke} strokeWidth={6} />
                  <line x1={x + w / 2 - 35} y1={yTop + i * fh + fh * 0.3} x2={x + w / 2 + 35} y2={yTop + i * fh + fh * 0.3} stroke={INK} strokeWidth={10} />
                </g>
              )
            })
          : Array.from({ length: frontCount }).map((_, i) => {
              const dw = (w - 3 * (frontCount + 1)) / frontCount
              const fx = x + 3 + i * (dw + 3)
              if (['fridge', 'oven', 'hob', 'dishwasher', 'filler', 'sink'].includes(u.kind)) return null
              return (
                <g key={i}>
                  <rect x={fx} y={yTop + 4} width={dw} height={hgt - 8} fill="none" stroke={stroke} strokeWidth={6} />
                  <line
                    x1={fx + dw / 2 - 25} y1={u.mounted === 'wall' ? yTop + hgt - 55 : yTop + 55}
                    x2={fx + dw / 2 + 25} y2={u.mounted === 'wall' ? yTop + hgt - 55 : yTop + 55}
                    stroke={INK} strokeWidth={10}
                  />
                </g>
              )
            })}
        {u.kind === 'sink' && (
          <rect x={x + w / 4} y={yTop + 25} width={w / 2} height={55} fill="none" stroke={INK} strokeWidth={8} rx={25} />
        )}
        {u.kind === 'oven' && (
          <rect x={x + 20} y={yTop + hgt * 0.25} width={w - 40} height={hgt * 0.55} fill="#111" stroke="#000" strokeWidth={6} />
        )}
        {label && (
          <text x={x + w / 2} y={yTop + hgt / 2} fontSize={fsUnit} textAnchor="middle" dominantBaseline="middle" fill={fill === '#2A2A2A' || fill === '#4A4A4A' || u.mounted === 'tall' ? '#fff' : INK}>
            {label}
          </text>
        )}
      </g>
    )
  }

  return (
    <g>
      {/* small wall heading inside the panel, top-left */}
      <text x={20} y={fsDim * 1.4} fontSize={fsDim} fontWeight={700} fill={INK}>{`Wall ${wall.id}`}</text>

      <rect x={0} y={0} width={W} height={H} fill="#EDE7DD" stroke={INK} strokeWidth={10} />
      <line x1={0} y1={H} x2={W} y2={H} stroke={INK} strokeWidth={16} />

      {/* openings */}
      {wall.obstructions.map(o => {
        if (o.kind === 'door') {
          return (
            <g key={o.id}>
              <rect x={o.offsetMm} y={Y(2100)} width={o.widthMm} height={2100} fill="#D9CBB6" stroke={INK} strokeWidth={10} />
              <text x={o.offsetMm + o.widthMm / 2} y={Y(1050)} fontSize={fsUnit} textAnchor="middle" fill={MUTED}>DOOR</text>
            </g>
          )
        }
        if (o.kind === 'window') {
          const sill = o.sillHeightMm ?? 900
          const hgt = o.heightMm ?? 1200
          return (
            <g key={o.id}>
              <rect x={o.offsetMm} y={Y(sill + hgt)} width={o.widthMm} height={hgt} fill="#BEE3F8" stroke={INK} strokeWidth={10} />
              <line x1={o.offsetMm} y1={Y(sill + hgt / 2)} x2={o.offsetMm + o.widthMm} y2={Y(sill + hgt / 2)} stroke={INK} strokeWidth={6} />
              <line x1={o.offsetMm + o.widthMm / 2} y1={Y(sill + hgt)} x2={o.offsetMm + o.widthMm / 2} y2={Y(sill)} stroke={INK} strokeWidth={6} />
              <text x={o.offsetMm + o.widthMm / 2} y={Y(sill + hgt) - 40} fontSize={fsUnit} textAnchor="middle" fill={MUTED}>WINDOW</text>
            </g>
          )
        }
        return null
      })}

      {/* plinth + worktop slabs over base runs */}
      {base.length > 0 && (
        <>
          <rect x={baseS} y={Y(PLINTH)} width={baseE - baseS} height={PLINTH} fill="#2E2E2E" />
          <rect x={baseS} y={Y(PLINTH + BASE_H + WORKTOP)} width={baseE - baseS} height={WORKTOP} fill="#3A3A3A" />
        </>
      )}

      {onWall.map(renderUnit)}

      {/* dimension chain below the plinth, with ticks */}
      {(() => {
        const y = H + 160
        return (
          <g>
            {onWall.filter(u => u.mounted !== 'wall').map(u => (
              <g key={u.instanceId}>
                <line x1={u.startMm} y1={y} x2={u.startMm + u.widthMm} y2={y} stroke={MUTED} strokeWidth={4} />
                <line x1={u.startMm} y1={y - tick / 2} x2={u.startMm} y2={y + tick / 2} stroke={MUTED} strokeWidth={4} />
                <line x1={u.startMm + u.widthMm} y1={y - tick / 2} x2={u.startMm + u.widthMm} y2={y + tick / 2} stroke={MUTED} strokeWidth={4} />
                <text x={u.startMm + u.widthMm / 2} y={y + fsDim * 1.3} fontSize={fsDim} textAnchor="middle" fill={MUTED}>{u.widthMm}</text>
              </g>
            ))}
            {/* overall */}
            <line x1={0} y1={y + fsDim * 2.6} x2={W} y2={y + fsDim * 2.6} stroke={MUTED} strokeWidth={5} />
            <line x1={0} y1={y + fsDim * 2.6 - tick} x2={0} y2={y + fsDim * 2.6 + tick} stroke={MUTED} strokeWidth={5} />
            <line x1={W} y1={y + fsDim * 2.6 - tick} x2={W} y2={y + fsDim * 2.6 + tick} stroke={MUTED} strokeWidth={5} />
            <text x={W / 2} y={y + fsDim * 4} fontSize={fsDim} fontWeight={600} textAnchor="middle" fill={INK}>{W}</text>
          </g>
        )
      })()}

      {/* ceiling height — small vertical dimension at the right edge */}
      <line x1={W + 80} y1={0} x2={W + 80} y2={H} stroke={MUTED} strokeWidth={4} />
      <line x1={W + 80 - tick / 2} y1={0} x2={W + 80 + tick / 2} y2={0} stroke={MUTED} strokeWidth={4} />
      <line x1={W + 80 - tick / 2} y1={H} x2={W + 80 + tick / 2} y2={H} stroke={MUTED} strokeWidth={4} />
      <text x={W + 160} y={H / 2} fontSize={fsDim} fill={MUTED} transform={`rotate(-90 ${W + 160} ${H / 2})`} textAnchor="middle">
        {ceilingMm}
      </text>
    </g>
  )
}

/** Front elevation per wall, stacked vertically. */
export default function ElevationView() {
  const { room } = useStore()
  const svgRef = useRef<SVGSVGElement>(null)

  const padL = 300
  const padR = 400
  const gap = 900 // between wall panels — room for the dim chain
  const wallH = Math.max(room.ceilingHeightMm, 2400)
  const maxW = Math.max(...room.walls.map(w => w.lengthMm), 2000)
  const totalH = room.walls.length * (wallH + gap)

  return (
    <div className="relative h-full w-full bg-[#D8D1C6] lg:absolute lg:bottom-[150px] lg:left-[440px] lg:right-6 lg:top-24 lg:h-auto lg:w-auto">
      <svg ref={svgRef} viewBox={`${-padL} ${-120} ${maxW + padL + padR} ${totalH + 200}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="hatchE" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="120" height="120" fill="#C9CDD2" />
            <line x1="0" y1="0" x2="0" y2="120" stroke="#7A7E83" strokeWidth="20" />
          </pattern>
        </defs>
        {room.walls.map((wall, i) => (
          <g key={wall.id} transform={`translate(0 ${i * (wallH + gap)})`}>
            <WallElevation wall={wall} ceilingMm={room.ceilingHeightMm} />
          </g>
        ))}
      </svg>

      <button
        onClick={() => downloadSvg(svgRef.current, 'kitchen-elevation.svg')}
        className="absolute bottom-4 right-4 rounded-full border border-hds-border bg-white/90 px-4 py-2 text-xs font-medium text-hds-black shadow-card transition-colors hover:bg-white"
      >
        Download drawing (SVG)
      </button>
    </div>
  )
}
