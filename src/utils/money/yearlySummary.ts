import type { Expense, FuelEntry, HistoryEntry } from '../../types'

export interface YearSummary {
  year: number
  fuel: number
  service: number
  other: number
  total: number
  /** Kilometres driven that year, from fuel/service odometer readings; null when there isn't enough data. */
  distanceKm: number | null
  /** Total spend divided by distance; null when distance is unknown or zero. */
  costPerKm: number | null
}

function yearOf(ts: number): number {
  return new Date(ts).getFullYear()
}

/** Per-calendar-year spend and cost per km, newest year first. Years with no recorded cost are omitted. */
export function buildYearlySummary(
  fuel: Pick<FuelEntry, 'date' | 'mileage' | 'cost'>[],
  history: Pick<HistoryEntry, 'date' | 'mileage' | 'cost'>[],
  expenses: Pick<Expense, 'date' | 'amount'>[],
): YearSummary[] {
  const byYear = new Map<number, { fuel: number; service: number; other: number }>()
  const bucket = (year: number) => {
    let b = byYear.get(year)
    if (!b) byYear.set(year, (b = { fuel: 0, service: 0, other: 0 }))
    return b
  }
  for (const f of fuel) if (f.cost) bucket(yearOf(f.date)).fuel += f.cost
  for (const h of history) if (h.cost) bucket(yearOf(h.date)).service += h.cost
  for (const e of expenses) if (e.amount) bucket(yearOf(e.date)).other += e.amount

  const readings = [...fuel, ...history].map((r) => ({ year: yearOf(r.date), mileage: r.mileage }))

  return [...byYear.entries()]
    .map(([year, b]) => {
      const inYear = readings.filter((r) => r.year === year).map((r) => r.mileage)
      const before = readings.filter((r) => r.year < year).map((r) => r.mileage)
      let distanceKm: number | null = null
      if (inYear.length > 0) {
        const end = Math.max(...inYear)
        const start = before.length > 0 ? Math.max(...before) : Math.min(...inYear)
        distanceKm = end - start > 0 ? end - start : null
      }
      const total = b.fuel + b.service + b.other
      return {
        year,
        ...b,
        total,
        distanceKm,
        costPerKm: distanceKm ? total / distanceKm : null,
      }
    })
    .sort((a, z) => z.year - a.year)
}
