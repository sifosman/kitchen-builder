# HDS Kitchen Builder

Deterministic kitchen designer for HDS Cut & Edge: guided room input →
rules engine proposes a cabinet layout from the standard library → 3D scene
with real board textures → live 3-tier pricing → quote + cut list via the
existing optimizer API.

## Stack

Vite · React 18 · TypeScript · Tailwind · zustand · react-three-fiber/drei.
Same visual stack as `kitchen-visualizer` (board-crop textures ported to
`public/images/cabinet-crops/`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest — engine unit tests
npm run build    # typecheck + production build
```

## Flow

1. **Room** — shape (straight / L / U), wall lengths, ceiling, and obstructions
   placed as offsets: door, window (sill height), plumbing point, hob, fridge,
   dishwasher, keep-clear zones.
2. **Layout** — `engine/propose.ts` pins fixed items (sink centred on
   plumbing, hob → oven unit + extractor zone, fridge + ventilation gap,
   dishwasher beside sink), then enumerates library-module combinations to
   fill the free spans. Scored on the CEO rules (fewer cabinets, 600/900
   widths preferred, 20–80mm fillers, drawers near prep, wall-unit symmetry)
   and validated against the hard rules — top 3 proposals shown.
3. **Edit** — click any unit in the 3D view to swap module, nudge along the
   wall (±50/100mm), or delete. Rule violations surface live.
4. **Price** — Value / Standard / Premium tiers (door board + hardware level);
   estimate breaks down carcass/door/backer sheets, edging metres, hardware,
   cutting and labour.
5. **Quote** — BOM → `POST /api/optimizer/quote` on the live Vercel API
   (`priceList: 'william'`, `source: 'kitchen-builder'`) → quote ID, PDF,
   cut list. **Mock mode is the default** — set `VITE_MOCK_API=false` and
   optionally `VITE_API_BASE` to hit the live API.

## Layout

```
src/
  data/    cabinetLibrary.ts · boardMaterials.ts · hardware.ts
  engine/  room.ts · rules.ts · propose.ts · bom.ts · pricing.ts
  api/     optimizerClient.ts · mockClient.ts
  ui/      RoomForm · KitchenScene3D · PricePanel · QuoteSheet · UnitEditor
```

Material descriptions in `boardMaterials.ts` match `hds_prices_william`
verbatim — the quote API resolves pricing by description.

## Deferred (post-V1)

Corner/island units, drag-to-move in 3D, `kitchen_designs` persistence,
SmartCut export, hardware line-items on the quote.
