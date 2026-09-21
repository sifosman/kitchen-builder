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
    {
      id: 'alaskan-cherry',
      name: 'Alaskan Cherry',
      apiDescription: 'INNOWOOD Chip Alaskan Cherry LNR 9x6x16 DF',
      pricePerSheet: 950,
      texture: 'woodgrain',
      hex: '#6B3E2E',
      renderTexture: '/images/cabinet-crops/alaskan-cherry-door.png',
      ...STD,
    },
    {
      id: 'american-white-oak',
      name: 'American White Oak',
      apiDescription: 'INNOWOOD Chip American White Oak LNR 9x6x16 DF',
      pricePerSheet: 850,
      texture: 'woodgrain',
      hex: '#D4C4A8',
      renderTexture: '/images/cabinet-crops/american-white-oak-door.png',
      ...STD,
    },
    {
      id: 'flagstaff-oak',
      name: 'Flagstaff Oak',
      apiDescription: 'INNOWOOD Chip Flagstaff Oak LNR 9x6x16 DF',
      pricePerSheet: 850,
      texture: 'woodgrain',
      hex: '#A0826D',
      renderTexture: '/images/cabinet-crops/flagstaff-oak-door.png',
      ...STD,
    },
    {
      id: 'lancaster-oak',
      name: 'Lancaster Oak',
      apiDescription: 'INNOWOOD Chip Lancaster Oak LNR 9x6x16 DF',
      pricePerSheet: 950,
      texture: 'woodgrain',
      hex: '#A0785A',
      renderTexture: '/images/cabinet-crops/lancaster-oak-door.png',
      ...STD,
    },
    {
      id: 'liberty-oak',
      name: 'Liberty Oak',
      apiDescription: 'INNOWOOD Chip Liberty Oak  LNR 9x6x16 DF',
      pricePerSheet: 950,
      texture: 'woodgrain',
      hex: '#B8956A',
      renderTexture: '/images/cabinet-crops/liberty-oak-door.png',
      ...STD,
    },
    {
      id: 'nappa-oak',
      name: 'Nappa Oak',
      apiDescription: 'INNOWOOD Chip Nappa Oak LNR 9x6x16 DF',
      pricePerSheet: 950,
      texture: 'woodgrain',
      hex: '#C4A77D',
      renderTexture: '/images/cabinet-crops/nappa-oak-door.png',
      ...STD,
    },
    {
      id: 'sienna-oak',
      name: 'Sienna Oak',
      apiDescription: 'INNOWOOD Chip Sienna Oak LNR 9x6x16 DF',
      pricePerSheet: 950,
      texture: 'woodgrain',
      hex: '#A0826D',
      renderTexture: '/images/cabinet-crops/sienna-oak-door.png',
      ...STD,
    },
    {
      id: 'washed-oak',
      name: 'Washed Oak',
      apiDescription: 'INNOWOOD Chip Washed Oak LNR 9x6x16 DF',
      pricePerSheet: 950,
      texture: 'woodgrain',
      hex: '#C9B896',
      renderTexture: '/images/cabinet-crops/washed-oak-door.png',
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
      id: 'beige-linnen-gloss',
      name: 'Beige Linnen Gloss',
      apiDescription: 'CHROMETREE GLS Beige Linnen 9x6x17 DF',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#D4C4A8',
      renderTexture: '/images/cabinet-crops/beige-linnen-gloss-door.png',
      ...GLS,
    },
    {
      id: 'black-gloss',
      name: 'Black Gloss',
      apiDescription: 'CHROMETREE GLS Black 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#1a1a1a',
      renderTexture: '/images/cabinet-crops/black-gloss-door.png',
      ...GLS,
    },
    {
      id: 'charcoal-grey-gloss',
      name: 'Charcoal Grey Gloss',
      apiDescription: 'CHROMETREE GLS Charcoal Grey 9x6x17 DF',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#36454F',
      renderTexture: '/images/cabinet-crops/charcoal-grey-gloss-door.png',
      ...GLS,
    },
    {
      id: 'desert-sky-gloss',
      name: 'Desert Sky Gloss',
      apiDescription: 'CHROMETREE GLS Desert Sky 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#C4B49A',
      renderTexture: '/images/cabinet-crops/desert-sky-gloss-door.png',
      ...GLS,
    },
    {
      id: 'driftwood-gloss',
      name: 'Driftwood Gloss',
      apiDescription: 'CHROMETREE GLS Driftwood 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#9A8B7A',
      renderTexture: '/images/cabinet-crops/driftwood-gloss-door.png',
      ...GLS,
    },
    {
      id: 'flagstaff-oak-gloss',
      name: 'Flagstaff Oak Gloss',
      apiDescription: 'CHROMETREE GLS Flagstaff Oak 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#A0826D',
      renderTexture: '/images/cabinet-crops/flagstaff-oak-gloss-door.png',
      ...GLS,
    },
    {
      id: 'glaston-berry-gloss',
      name: 'Glaston Berry Gloss',
      apiDescription: 'CHROMETREE GLS Glaston Berry 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#8A9A8A',
      renderTexture: '/images/cabinet-crops/glaston-berry-gloss-door.png',
      ...GLS,
    },
    {
      id: 'liberty-oak-gloss',
      name: 'Liberty Oak Gloss',
      apiDescription: 'CHROMETREE GLS Liberty Oak 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#B8956A',
      renderTexture: '/images/cabinet-crops/liberty-oak-gloss-door.png',
      ...GLS,
    },
    {
      id: 'metallic-cappuccino-gloss',
      name: 'Metallic Cappuccino Gloss',
      apiDescription: 'CHROMETREE GLS Metalic Cappuccino 9x6x17 DF',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#8B7355',
      renderTexture: '/images/cabinet-crops/metallic-cappuccino-gloss-door.png',
      ...GLS,
    },
    {
      id: 'metropolitan-loft-gloss',
      name: 'Metropolitan Loft Gloss',
      apiDescription: 'CHROMETREE GLS Metropolitan Loft 9x6x17',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#7A828E',
      renderTexture: '/images/cabinet-crops/metropolitan-loft-gloss-door.png',
      ...GLS,
    },
    {
      id: 'olivia-gloss',
      name: 'Olivia Gloss',
      apiDescription: 'CHROMETREE GLS Olivia 9x6x17mm',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#B8A88A',
      renderTexture: '/images/cabinet-crops/olivia-gloss-door.png',
      ...GLS,
    },
    {
      id: 'pearl-grey-gloss',
      name: 'Pearl Grey Gloss',
      apiDescription: 'CHROMETREE GLS Pearl Grey 9x6x17mm',
      pricePerSheet: 2150,
      texture: 'gloss',
      hex: '#C0C0C0',
      renderTexture: '/images/cabinet-crops/pearl-grey-gloss-door.png',
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
