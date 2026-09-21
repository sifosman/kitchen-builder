// Local guillotine first-fit-decreasing nesting — mirrors the live
// optimizer.service.ts guillotine split (right remainder + bottom strip,
// kerf added to the used extent) so the on-screen cut map resembles the
// factory's. The live quote API stays the authority at submit time.

import type { Bom } from './bom'
import { CARCASS_BOARD, type BoardMaterial } from '../data/boardMaterials'

export interface NestPiece {
  id: string
  cabinetRef: string
  part: string
  lengthMm: number
  widthMm: number
  material: 'carcass' | 'door' | 'back'
  edging: string
  canRotate: boolean
}

export interface Placement extends NestPiece {
  x: number
  y: number
  rotated: boolean
}

export interface Offcut {
  x: number
  y: number
  w: number
  l: number
  /** both dims ≥ 150mm — big enough to reuse */
  recoverable: boolean
}

export interface NestedBoard {
  material: NestPiece['material']
  sheetLengthMm: number
  sheetWidthMm: number
  placements: Placement[]
  offcuts: Offcut[]
  usedAreaMm2: number
  yieldPct: number
}

export interface NestResult {
  boards: NestedBoard[]
  byMaterial: Record<NestPiece['material'], { boards: number; yieldPct: number }>
  unplaced: NestPiece[]
}

const BACKER_SHEET = { sheetLengthMm: 2750, sheetWidthMm: 1830 }

interface FreeRect {
  x: number
  y: number
  w: number
  h: number
}

function nestPieces(pieces: NestPiece[], sheetL: number, sheetW: number, kerf: number): { boards: NestedBoard[]; unplaced: NestPiece[] } {
  // largest area first
  const remaining = [...pieces].sort((a, b) => b.lengthMm * b.widthMm - a.lengthMm * a.widthMm)
  const boards: NestedBoard[] = []

  while (remaining.length > 0) {
    const freeRects: FreeRect[] = [{ x: 0, y: 0, w: sheetL, h: sheetW }]
    const placements: Placement[] = []

    let i = 0
    while (i < remaining.length) {
      const piece = remaining[i]
      let placed = false

      for (let j = 0; j < freeRects.length; j++) {
        const rect = freeRects[j]

        const fitsNormal = piece.lengthMm <= rect.w && piece.widthMm <= rect.h
        const fitsRotated = piece.canRotate && piece.widthMm <= rect.w && piece.lengthMm <= rect.h
        if (!fitsNormal && !fitsRotated) continue

        // both orientations fit → pick the one with less leftover waste
        let rotated = false
        if (fitsNormal && fitsRotated) {
          const normalWaste = (rect.w - piece.lengthMm) * (rect.h - piece.widthMm)
          const rotatedWaste = (rect.w - piece.widthMm) * (rect.h - piece.lengthMm)
          rotated = rotatedWaste < normalWaste
        } else {
          rotated = !fitsNormal
        }

        const placedL = rotated ? piece.widthMm : piece.lengthMm
        const placedW = rotated ? piece.lengthMm : piece.widthMm
        placements.push({ ...piece, x: rect.x, y: rect.y, rotated })

        // split: right remainder spans the full rect height; bottom strip
        // only as wide as the piece + kerf (same as the live service)
        freeRects.splice(j, 1)
        const usedW = placedL + kerf
        const usedH = placedW + kerf
        if (rect.w - usedW > 0) {
          freeRects.push({ x: rect.x + usedW, y: rect.y, w: rect.w - usedW, h: rect.h })
        }
        if (rect.h - usedH > 0) {
          freeRects.push({ x: rect.x, y: rect.y + usedH, w: usedW, h: rect.h - usedH })
        }

        remaining.splice(i, 1)
        placed = true
        break
      }

      if (!placed) i++
    }

    // a board that placed nothing means the remaining pieces are oversized
    if (placements.length === 0) break

    const sheetArea = sheetL * sheetW
    const usedArea = placements.reduce((s, p) => s + p.lengthMm * p.widthMm, 0)
    const offcuts: Offcut[] = freeRects
      .filter(r => r.w >= 50 && r.h >= 50)
      .map(r => ({ x: r.x, y: r.y, w: r.w, l: r.h, recoverable: r.w >= 150 && r.h >= 150 }))

    boards.push({
      material: pieces[0]?.material ?? 'carcass',
      sheetLengthMm: sheetL,
      sheetWidthMm: sheetW,
      placements,
      offcuts,
      usedAreaMm2: usedArea,
      yieldPct: Math.round((usedArea / sheetArea) * 1000) / 10,
    })
  }

  return { boards, unplaced: remaining }
}

export function nestBom(bom: Bom, doorMaterial: BoardMaterial, opts?: { kerfMm?: number }): NestResult {
  const kerf = opts?.kerfMm ?? 3
  const woodgrain = doorMaterial.texture === 'woodgrain' || doorMaterial.texture === 'linear'

  // expand lines into individual pieces
  const pieces: NestPiece[] = []
  bom.lines.forEach((line, li) => {
    for (let n = 0; n < line.qty; n++) {
      pieces.push({
        id: `${li}-${n}`,
        cabinetRef: `${line.instanceId} · ${line.moduleName}`,
        part: line.part,
        lengthMm: line.lengthMm,
        widthMm: line.widthMm,
        material: line.material,
        edging: line.edging,
        canRotate: !(line.material === 'door' && woodgrain),
      })
    }
  })

  const sheetFor = (material: NestPiece['material']) =>
    material === 'carcass' ? CARCASS_BOARD : material === 'door' ? doorMaterial : BACKER_SHEET

  const boards: NestedBoard[] = []
  const unplaced: NestPiece[] = []

  for (const material of ['carcass', 'door', 'back'] as const) {
    const group = pieces.filter(p => p.material === material)
    if (group.length === 0) continue
    const sheet = sheetFor(material)
    const res = nestPieces(group, sheet.sheetLengthMm, sheet.sheetWidthMm, kerf)
    boards.push(...res.boards)
    unplaced.push(...res.unplaced)
  }

  const byMaterial = {} as NestResult['byMaterial']
  for (const material of ['carcass', 'door', 'back'] as const) {
    const group = boards.filter(b => b.material === material)
    const sheet = sheetFor(material)
    const sheetArea = sheet.sheetLengthMm * sheet.sheetWidthMm
    const used = group.reduce((s, b) => s + b.usedAreaMm2, 0)
    byMaterial[material] = {
      boards: group.length,
      yieldPct: group.length ? Math.round((used / (group.length * sheetArea)) * 1000) / 10 : 0,
    }
  }

  return { boards, byMaterial, unplaced }
}
