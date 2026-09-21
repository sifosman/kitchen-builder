// Offline/mock quote client — same interface as optimizerClient so the demo
// runs without hitting the live API.

import type { Bom } from '../engine/bom'
import type { BoardMaterial } from '../data/boardMaterials'
import type { Tier } from '../engine/pricing'
import { priceKitchen } from '../engine/pricing'
import type { QuoteResult } from './optimizerClient'

export async function requestMockQuote(
  bom: Bom,
  doorMaterial: BoardMaterial,
  tier: Tier,
  customer: { name: string; phone: string; project: string },
): Promise<QuoteResult> {
  await new Promise(r => setTimeout(r, 700)) // simulate latency
  const est = priceKitchen(bom, doorMaterial, tier)
  const quoteId = `Q-MOCK-${Date.now().toString(36).toUpperCase()}`
  return {
    success: true,
    quoteId,
    finalTotal: est.total,
    grandTotal: est.carcassCost + est.doorCost + est.backerCost,
    totalCuttingFee: est.cuttingCost,
    totalEdgingCost: est.edgingCost,
    hardwareTotal: est.hardwareCost,
    vat: Math.round((est.total * 15) / 115),
    subtotal: Math.round(est.total - (est.total * 15) / 115),
    quotePdfUrl: '#mock-quote-pdf',
    cutlistPdfUrl: '#mock-cutlist-pdf',
    message: `Mock quote for ${customer.name || 'demo customer'} — no live API call made.`,
  }
}

/** True when the app should use the mock client (offline demo / no env flag). */
export function useMockApi(): boolean {
  const flag = (import.meta as any).env?.VITE_MOCK_API
  if (flag === 'true') return true
  if (flag === 'false') return false
  // default: mock unless explicitly disabled — keeps demos safe
  return true
}
