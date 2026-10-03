import { describe, expect, it } from 'vitest'
import { buildWarranties } from '../money/warranty'
import { buildMasterStats } from '../money/masterStats'
import { monthSpend } from '../money/budget'

describe('warranty', () => {
  const now = new Date(2026, 5, 1).getTime()
  it('lists active part warranties soonest first and drops expired', () => {
    const rows = buildWarranties(
      [
        { id: 'h1', date: new Date(2026, 0, 1).getTime(), itemName: 'Колодки', items: [{ id: 'i1', kind: 'part', name: 'Колодки', amount: 1, warrantyMonths: 6 }] },
        { id: 'h2', date: new Date(2024, 0, 1).getTime(), itemName: 'Старое', items: [{ id: 'i2', kind: 'part', name: 'x', amount: 1, warrantyMonths: 6 }] },
      ],
      [],
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].remainingDays).toBeGreaterThan(0)
  })
})

describe('master stats', () => {
  it('sums visits, spend and labor per master', () => {
    const m = buildMasterStats(
      [{ masterId: 'a', cost: 1000, items: [{ id: '1', kind: 'labor', name: '', amount: 400 }] }, { masterId: 'a', cost: 500 }, { cost: 9 }],
      [{ masterId: 'b', amount: 70 }],
    )
    expect(m.get('a')).toEqual({ count: 2, total: 1500, labor: 400, laborCount: 1 })
    expect(m.get('b')?.total).toBe(70)
    expect(m.size).toBe(2)
  })
})

describe('monthSpend', () => {
  it('counts only the current month', () => {
    const now = new Date(2026, 5, 15).getTime()
    const inMonth = new Date(2026, 5, 2).getTime()
    const prev = new Date(2026, 4, 30).getTime()
    expect(monthSpend([{ date: inMonth, cost: 10 }, { date: prev, cost: 99 }], [{ date: inMonth, cost: 5 }], [{ date: inMonth, amount: 1 }], now)).toBe(16)
  })
})
