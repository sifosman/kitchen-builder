// Board materials seeded from the William price list (hds_prices_william).
// apiDescription must match the `description` column verbatim — the quote API
// looks pricing up by description (exact → ilike → wildcard fallback).

export type BoardTexture =
  | 'gloss'
  | 'super-matte'
  | 'matt'
  | 'woodgrain'
  | 'peen'
  | 'fusion'
  | 'linear'

export interface BoardMaterial {
  id: string
  name: string
  /** Exact description in hds_prices_william — sent as section.material */
  apiDescription: string
  /** Price per 2750×1830 sheet, R incl VAT */
  pricePerSheet: number
  texture: BoardTexture
  hex: string
  /** Pre-cropped door texture for the 3D render (from kitchen-visualizer) */
  renderTexture?: string
  sheetLengthMm: number
  sheetWidthMm: number
  thicknessMm: number
}

const STD = { sheetLengthMm: 2750, sheetWidthMm: 1830, thicknessMm: 16 }
const GLS = { sheetLengthMm: 2750, sheetWidthMm: 1830, thicknessMm: 17 }

/** Standard white-melamine carcass board (HDS staple). */
export const CARCASS_BOARD: BoardMaterial = {
  id: 'premium-white',
  name: 'Premium White',
  apiDescription: 'INNOWOOD Chip Premium White Txt 9x6x16 DF',
  pricePerSheet: 620,
  texture: 'matt',
  hex: '#F7F7F5',
  ...STD,
}

/** Door/front board options grouped by price tier. */
export const DOOR_MATERIALS: Record<'value' | 'standard' | 'premium', BoardMaterial[]> = {
  value: [
    {
      id: 'premium-white',
      name: 'Premium White',
      apiDescription: 'INNOWOOD Chip Premium White Txt 9x6x16 DF',
      pricePerSheet: 620,
      texture: 'matt',
      hex: '#F7F7F5',
      ...STD,
    },
    {
      id: 'dakota-oak',
      name: 'Dakota Oak',
      apiDescription: 'INNOWOOD Chip Dakota Oak  LNR 9x6x16 DF',
      pricePerSheet: 950,
      texture: 'woodgrain',
      hex: '#9A7B4F',
      renderTexture: '/images/cabinet-crops/dakota-oak-door.png',
      ...STD,
    },
    {
      id: 'moonstone',
      name: 'Moonstone Grey',
      apiDescription: 'INNOWOOD Chip MoonStone Grey Txt 9x6x16 DF',
      pricePerSheet: 875,
      texture: 'matt',
      hex: '#C6C6C6',
      ...STD,
    },
    {
      id: 'white-cedar',
      name: 'White Cedar',
      apiDescription: 'INNOWOOD Chip White Cedar LNR 9x6x16 DF',
      pricePerSheet: 850,
      texture: 'woodgrain',
      hex: '#D7D3C7',
      ...STD,
    },
  ],
  standard: [
    {
      id: 'storm-grey-peen',
      name: 'Storm Grey Peen',
      apiDescription: 'PG Bison Melawood on Chipboard Storm Grey Peen',
      pricePerSheet: 1150,
      texture: 'peen',
      hex: '#7A7D82',
      ...STD,
    },
    {
      id: 'brookhill-fusion',
      name: 'Brookhill Fusion',
      apiDescription: 'PG Bison Melawood on Chipboard Brookhill Fusion',
      pricePerSheet: 1260,
      texture: 'fusion',
      hex: '#A89684',
      ...STD,
    },
    {
      id: 'iceberg-white-peen',
      name: 'Iceberg White Peen',
      apiDescription: 'PG Bison Melawood on Chipboard Iceberg White Peen',
      pricePerSheet: 1150,
      texture: 'peen',
      hex: '#EFEFEA',
      ...STD,
    },
    {
      id: 'african-wenge',
      name: 'African Wenge Fusion',
      apiDescription: 'PG Bison Melawood on Chipboard African Wenge Fusion',
      pricePerSheet: 1350,
      texture: 'fusion',
      hex: '#4A3B32',
      ...STD,
    },
  ],
  premium: [
    {
      id: 'iceland-gloss',
      name: 'Iceland White Gloss',
      apiDescription: 'CHROMETREE GLS Iceland White 9x6x17',
      pricePerSheet: 2050,
      texture: 'gloss',
      hex: '#F5F5F5',
      renderTexture: '/images/cabinet-crops/iceland-gloss-door.png',
      ...GLS,
    },
    {
      id: 'dakota-oak-gloss',
      name: 'Dakota Oak Gloss',
      apiDescription: 'CHROMETREE GLS Dakota Oak 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#9A7B4F',
      renderTexture: '/images/cabinet-crops/dakota-oak-gloss-door.png',
      ...GLS,
    },
    {
      id: 'moonstone-gloss',
      name: 'Moonstone Gloss',
      apiDescription: 'CHROMETREE GLS MoonStone 9x6x17 Grey',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#B8B8B8',
      renderTexture: '/images/cabinet-crops/moonstone-gloss-door.png',
      ...GLS,
    },
    {
      id: 'iceland-silktouch',
      name: 'Iceland White SilkTouch',
      apiDescription: 'MDF Silktouch Iceland White Ultra Matte 9x6x16',
      pricePerSheet: 2500,
      texture: 'super-matte',
      hex: '#FFFFFF',
      ...STD,
    },
    {
      id: 'kashmir-silktouch',
      name: 'Kashmir SilkTouch',
      apiDescription: 'MDF Silktouch Kashmir Ultra Matte 9x6x16',
      pricePerSheet: 2500,
      texture: 'super-matte',
      hex: '#C2C0B4',
      ...STD,
    },
  ],
}

export function allDoorMaterials(): BoardMaterial[] {
  return [...DOOR_MATERIALS.value, ...DOOR_MATERIALS.standard, ...DOOR_MATERIALS.premium]
}

export function findDoorMaterial(id: string): BoardMaterial | undefined {
  return allDoorMaterials().find(m => m.id === id)
}
