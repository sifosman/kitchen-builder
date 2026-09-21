// Client for the live HDS optimizer/quote API (hdsproject1 on Vercel).
// Contract verified against server/src/controllers/optimizer.controller.ts:
//   POST /api/optimizer/quote
//   { sections: [{ material, edgingType, cutPieces: [{ name, length, width, amount, edging }] }],
//     customerName, projectName, phoneNumber, branchData, hardware, source, priceList }
// Material = exact hds_prices_william description; priceList 'william' applies
// the William price list + CUT96 cutting rate.

import type { Bom, BomLine } from '../engine/bom'
import type { BoardMaterial } from '../data/boardMaterials'
import { CARCASS_BOARD } from '../data/boardMaterials'
import type { Tier } from '../engine/pricing'

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || 'https://hds-sifosmans-projects.vercel.app'

export interface QuotePiece {
  name: string
  length: number
  width: number
  amount: number
  edging: string
  edgingType?: string
}

export interface QuoteSection {
  material: string
  quantity: number
  edgingType: string
  cutPieces: QuotePiece[]
}

export interface QuoteRequest {
  sections: QuoteSection[]
  customerName: string
  projectName: string
  phoneNumber: string
  source: string
  priceList: string
  hardware?: Array<{ description: string; quantity: number }>
}

export interface QuoteResult {
  success: boolean
  quoteId?: string
  finalTotal?: number
  grandTotal?: number
  totalCuttingFee?: number
  totalEdgingCost?: number
  hardwareTotal?: number
  vat?: number
  subtotal?: number
  quotePdfUrl?: string
  cutlistPdfUrl?: string
  invoicePdfUrl?: string
  message?: string
  error?: string
}

const BACKER_DESCRIPTION = 'MDF Supawood 9x6x3mm Raw'
const CARCASS_EDGING_TYPE = '0.4mm PVC'
const DOOR_EDGING_TYPE = '1.0mm PVC'

function linesToPieces(lines: BomLine[]): QuotePiece[] {
  return lines.map(l => ({
    name: `${l.moduleName} — ${l.part}`,
    length: l.lengthMm,
    width: l.widthMm,
    amount: l.qty,
    edging: l.edging,
  }))
}

/** Convert a BOM into quote-API sections, one per board material. */
export function bomToSections(bom: Bom, doorMaterial: BoardMaterial): QuoteSection[] {
  const carcass = bom.lines.filter(l => l.material === 'carcass')
  const doors = bom.lines.filter(l => l.material === 'door')
  const backs = bom.lines.filter(l => l.material === 'back')
  const sections: QuoteSection[] = []
  if (carcass.length) {
    sections.push({
      material: CARCASS_BOARD.apiDescription,
      quantity: carcass.reduce((s, l) => s + l.qty, 0),
      edgingType: CARCASS_EDGING_TYPE,
      cutPieces: linesToPieces(carcass),
    })
  }
  if (doors.length) {
    sections.push({
      material: doorMaterial.apiDescription,
      quantity: doors.reduce((s, l) => s + l.qty, 0),
      edgingType: DOOR_EDGING_TYPE,
      cutPieces: linesToPieces(doors),
    })
  }
  if (backs.length) {
    sections.push({
      material: BACKER_DESCRIPTION,
      quantity: backs.reduce((s, l) => s + l.qty, 0),
      edgingType: '',
      cutPieces: linesToPieces(backs),
    })
  }
  return sections
}

export async function requestQuote(
  bom: Bom,
  doorMaterial: BoardMaterial,
  tier: Tier,
  customer: { name: string; phone: string; project: string },
): Promise<QuoteResult> {
  const body: QuoteRequest = {
    sections: bomToSections(bom, doorMaterial),
    customerName: customer.name || 'Kitchen Builder Customer',
    projectName: customer.project || `Kitchen — ${tier}`,
    phoneNumber: customer.phone || '',
    source: 'kitchen-builder',
    priceList: 'william',
  }
  const res = await fetch(`${API_BASE}/api/optimizer/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    return {
      success: false,
      message: json?.message || `Quote API returned ${res.status}`,
      error: json?.error,
    }
  }
  const d = json.data || {}
  return {
    success: true,
    quoteId: d.quoteId,
    finalTotal: d.finalTotal,
    grandTotal: d.grandTotal,
    totalCuttingFee: d.totalCuttingFee,
    totalEdgingCost: d.totalEdgingCost,
    hardwareTotal: d.hardwareTotal,
    vat: d.vat,
    subtotal: d.subtotal,
    quotePdfUrl: d.quotePdfUrl,
    cutlistPdfUrl: d.cutlistPdfUrl,
    invoicePdfUrl: d.invoicePdfUrl,
  }
}
