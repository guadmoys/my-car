import { describe, expect, it } from 'vitest'
import { buildYearlySummary } from '../yearlySummary'

const d = (y: number, m = 5) => new Date(y, m, 15).getTime()

describe('buildYearlySummary', () => {
  it('returns nothing without costs', () => {
    expect(buildYearlySummary([{ date: d(2024), mileage: 1000 }], [], [])).toEqual([])
  })

  it('sums each category per year, newest first', () => {
    const result = buildYearlySummary(
      [
        { date: d(2024), mileage: 10000, cost: 1000 },
        { date: d(2025), mileage: 20000, cost: 2000 },
      ],
      [{ date: d(2025), mileage: 20500, cost: 500 }],
      [{ date: d(2025), amount: 300 }],
    )
    expect(result.map((r) => r.year)).toEqual([2025, 2024])
    expect(result[0]).toMatchObject({ fuel: 2000, service: 500, other: 300, total: 2800 })
  })

  it('measures distance from the last reading of the previous year', () => {
    const [y2025] = buildYearlySummary(
      [
        { date: d(2024), mileage: 10000, cost: 1 },
        { date: d(2025), mileage: 12000, cost: 4000 },
      ],
      [],
      [],
    )
    expect(y2025.distanceKm).toBe(2000)
    expect(y2025.costPerKm).toBe(2)
  })

  it('falls back to the in-year span for the first year', () => {
    const [first] = buildYearlySummary(
      [
        { date: d(2024, 1), mileage: 10000, cost: 1000 },
        { date: d(2024, 9), mileage: 11000, cost: 1000 },
      ],
      [],
      [],
    )
    expect(first.distanceKm).toBe(1000)
    expect(first.costPerKm).toBe(2)
  })

  it('has no cost per km when distance is unknown', () => {
    const [only] = buildYearlySummary([], [], [{ date: d(2024), amount: 500 }])
    expect(only.distanceKm).toBeNull()
    expect(only.costPerKm).toBeNull()
  })
})
