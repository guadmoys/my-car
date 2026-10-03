import { describe, expect, it } from 'vitest'
import { buildCostStructure } from '../costStructure'

describe('buildCostStructure', () => {
  it('splits service cost into parts, labor and the rest', () => {
    const rows = buildCostStructure(
      [{ cost: 1000 }],
      [{ cost: 5000, items: [{ id: 'a', kind: 'part', name: 'Колодки', amount: 3000 }, { id: 'b', kind: 'labor', name: 'Замена', amount: 1500 }] }],
      [{ amount: 500, category: 'fine' }],
    )
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.amount]))
    expect(byKey['service-part']).toBe(3000)
    expect(byKey['service-labor']).toBe(1500)
    expect(byKey['service-rest']).toBe(500)
    expect(byKey.fuel).toBe(1000)
    expect(byKey['expense-fine']).toBe(500)
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1)
    expect(rows[0].key).toBe('service-part')
  })

  it('scales down a breakdown that exceeds the total', () => {
    const rows = buildCostStructure([], [{ cost: 1000, items: [{ id: 'a', kind: 'part', name: 'x', amount: 3000 }] }], [])
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(1000)
  })

  it('omits zero rows and handles empty input', () => {
    expect(buildCostStructure([{ cost: undefined }], [{ cost: undefined }], [])).toEqual([])
  })
})
