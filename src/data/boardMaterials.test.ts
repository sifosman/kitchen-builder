import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { allDoorMaterials, DOOR_MATERIALS } from './boardMaterials'

describe('door materials', () => {
  it('has unique ids', () => {
    const ids = allDoorMaterials().map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every material has a positive price per sheet', () => {
    for (const m of allDoorMaterials()) {
      expect(m.pricePerSheet, m.id).toBeGreaterThan(0)
    }
  })

  it('every renderTexture file exists under public/', () => {
    for (const m of allDoorMaterials()) {
      if (!m.renderTexture) continue
      const p = path.join(process.cwd(), 'public', m.renderTexture)
      expect(fs.existsSync(p), `${m.id}: ${m.renderTexture}`).toBe(true)
    }
  })

  it('tier lists are non-empty', () => {
    for (const tier of ['value', 'standard', 'premium'] as const) {
      expect(DOOR_MATERIALS[tier].length).toBeGreaterThan(0)
    }
  })
})
