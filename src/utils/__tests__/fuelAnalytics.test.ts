import { describe, expect, it } from 'vitest'
import {
  analyzeConsumption,
  averageFuelPrice,
  buildFuelInsights,
  estimatedRange,
  forecastCosts,
  monthDistance,
  totalCo2Kg,
} from '../fuelAnalytics'
import type { FuelConsumption, FuelEntry } from '../../types'

const DAY = 86400000
const fill = (over: Partial<FuelEntry> & { mileage: number; liters: number }): FuelEntry =>
  ({ id: `f${over.mileage}`, carId: 'c', date: over.mileage * 1000, ...over }) as FuelEntry
const car = { tankCapacity: 50 as number | undefined, initialMileage: 1000 }

describe('analyzeConsumption', () => {
  it('measures full-tank to full-tank, skipping the first fill-up (its starting level is a guess)', () => {
    const r = analyzeConsumption([fill({ mileage: 1500, liters: 40 }), fill({ mileage: 2000, liters: 40 }), fill({ mileage: 2500, liters: 35 })], car)
    const l100 = r.history.map((h) => h.litersPer100km)
    expect(l100[0]).toBeCloseTo(7, 6) // newest first: 35 L over 500 km
    expect(l100[1]).toBeCloseTo(8, 6)
    expect(l100[2]).toBeNull()
    expect(r.average).toBeCloseTo((75 / 1000) * 100, 6)
    expect(r.history.map((h) => h.distanceKm)).toEqual([500, 500, 500])
  })

  it('uses the stated remaining litres of a partial fill-up as an anchor', () => {
    const r = analyzeConsumption(
      [fill({ mileage: 1500, liters: 40 }), fill({ mileage: 2000, liters: 20, isFullTank: false, remainingLiters: 10 }), fill({ mileage: 2500, liters: 30 })],
      car,
    )
    // Full tank (50 L), then 10 L left before the partial: 40 L burned over 500 km. The partial leaves 30 L;
    // the next fill-up of 30 L tops it up to full, so the tank held 20 L before it: 10 L burned over 500 km.
    const l100 = r.history.map((h) => h.litersPer100km)
    expect(l100[0]).toBeCloseTo(2, 6)
    expect(l100[1]).toBeCloseTo(8, 6)
    expect(l100[2]).toBeNull()
  })

  it('folds a partial fill-up with unknown level into the next full one', () => {
    const r = analyzeConsumption(
      [fill({ mileage: 1500, liters: 40 }), fill({ mileage: 2000, liters: 10, isFullTank: false }), fill({ mileage: 2500, liters: 30 })],
      car,
    )
    const last = r.history[0]
    expect(last.litersPer100km).toBeCloseTo(((10 + 30) / 1000) * 100, 6)
  })

  it('ignores a fill-up whose mileage goes backwards instead of corrupting later ones', () => {
    const r = analyzeConsumption(
      [fill({ mileage: 1500, liters: 40 }), fill({ mileage: 2000, liters: 40 }), fill({ mileage: 2000, liters: 5, date: 1 }), fill({ mileage: 2500, liters: 40 })],
      car,
    )
    expect(r.average).not.toBeNull()
    for (const h of r.history) if (h.litersPer100km !== null) expect(h.litersPer100km).toBeGreaterThan(0)
  })

  it('has no average with fewer than two usable fill-ups', () => {
    expect(analyzeConsumption([], car)).toMatchObject({ history: [], average: null })
    expect(analyzeConsumption([fill({ mileage: 1500, liters: 40 })], car).average).toBeNull()
  })

  it('tracks the tank level, which needs the tank capacity unless the whole chain is anchored by stated levels', () => {
    const twoFull = [fill({ mileage: 1500, liters: 40 }), fill({ mileage: 2000, liters: 40 })]
    expect(analyzeConsumption(twoFull, car).currentLevelLiters).toBe(50)
    expect(analyzeConsumption(twoFull, { initialMileage: 1000 }).currentLevelLiters).toBeNull()
    const partial = [fill({ mileage: 1500, liters: 40 }), fill({ mileage: 2000, liters: 20, isFullTank: false, remainingLiters: 10 })]
    expect(analyzeConsumption(partial, car).currentLevelLiters).toBe(30) // 10 L left plus the 20 L just added
    // Without a capacity the earlier full tank cannot be turned into litres, so the level stays unknown.
    expect(analyzeConsumption(partial, { initialMileage: 1000 }).currentLevelLiters).toBeNull()
  })
})

describe('small helpers', () => {
  it('estimates range only from a known, non-negative level and a positive average', () => {
    expect(estimatedRange(30, 6)).toBe(500)
    expect(estimatedRange(null, 6)).toBeNull()
    expect(estimatedRange(-1, 6)).toBeNull()
    expect(estimatedRange(30, 0)).toBeNull()
    expect(estimatedRange(30, null)).toBeNull()
  })

  it('averages the price per litre over priced fill-ups only', () => {
    expect(averageFuelPrice([{ liters: 10, cost: 500 }, { liters: 30, cost: 1800 }, { liters: 99, cost: undefined }])).toBe(57.5)
    expect(averageFuelPrice([{ liters: 10 }])).toBeNull()
  })

  it('applies a CO₂ factor by fuel type, gasoline by default', () => {
    expect(totalCo2Kg([{ liters: 10 }])).toBeCloseTo(23.1)
    expect(totalCo2Kg([{ liters: 10, fuelType: 'Дизель' }])).toBeCloseTo(26.8)
    expect(totalCo2Kg([{ liters: 10, fuelType: 'Газ (пропан)' }])).toBeCloseTo(15.1)
  })

  it('measures this month against the last reading before it, or the car\'s start', () => {
    const now = new Date(2026, 5, 20).getTime()
    const lastMonth = new Date(2026, 4, 25).getTime()
    expect(monthDistance({ initialMileage: 1000, createdAt: lastMonth - 99 * DAY, currentMileage: 1800 }, [{ mileage: 1500, date: lastMonth }], [], now)).toBe(300)
    expect(monthDistance({ initialMileage: 1000, createdAt: now - DAY, currentMileage: 1800 }, [], [], now)).toBe(800)
    expect(monthDistance({ initialMileage: 1000, createdAt: 0, currentMileage: 900 }, [], [], now)).toBe(0)
  })
})

describe('forecastCosts', () => {
  const now = new Date(2026, 5, 20).getTime()
  it('needs two priced fill-ups spread over at least three days', () => {
    const none = { sixMonths: null, twelveMonths: null }
    expect(forecastCosts({ fuelEntries: [{ date: now - 10 * DAY, cost: 1000 }], historyEntries: [], items: [], dailyKm: null, now })).toEqual(none)
    expect(forecastCosts({ fuelEntries: [{ date: now - 2 * DAY, cost: 1000 }, { date: now - DAY, cost: 1000 }], historyEntries: [], items: [], dailyKm: null, now })).toEqual(none)
  })

  it('projects fuel from the recent spend rate and maintenance from the average service', () => {
    const f = forecastCosts({
      fuelEntries: [{ date: now - 30 * DAY, cost: 3000 }, { date: now - 15 * DAY, cost: 3000 }],
      historyEntries: [{ cost: 6000 }, { cost: undefined }],
      items: [{ intervalMonths: 6, intervalKm: 10000 }],
      dailyKm: null,
      now,
    })
    expect(f.sixMonths!.fuel).toBeCloseTo((6000 / 30) * 6 * 30.44, 0)
    expect(f.sixMonths!.maintenance).toBeCloseTo(6000 * (6 * 30.44) / (6 * 30.44), 0) // one service in six months
    expect(f.twelveMonths!.total).toBeCloseTo(f.sixMonths!.total * 2, 0)
  })
})

describe('buildFuelInsights', () => {
  const row = (i: number, l100: number | null, quality: FuelConsumption['quality'] = 'neutral'): FuelConsumption => ({
    entry: fill({ mileage: 2000 - i * 500, liters: 40, date: 1_000_000 - i * 9 * DAY, cost: 2000, station: i % 2 ? 'A' : 'B' }),
    distanceKm: 500,
    litersPer100km: l100,
    quality,
  })
  const base = { car: {}, fuelEntries: [] as FuelEntry[], averageConsumption: 8, rangeKm: null, dailyKm: null, currency: '₽', now: 5_000_000 }

  it('flags the latest fill-up when it is far outside the earlier ones (compared with them, not with itself)', () => {
    const history = [row(0, 14), ...[0, 1, 2, 3, 4].map((i) => row(i + 1, 7.8 + (i % 2) * 0.3))]
    const ids = buildFuelInsights({ ...base, history }).map((i) => i.id)
    expect(ids).toContain('anomaly')
  })

  it('stays quiet about an ordinary fill-up', () => {
    const history = [row(0, 8.1), ...[0, 1, 2, 3, 4].map((i) => row(i + 1, 7.8 + (i % 2) * 0.3))]
    expect(buildFuelInsights({ ...base, history }).map((i) => i.id)).not.toContain('anomaly')
  })

  it('reports a worsening trend with the right tone', () => {
    const history = [10, 10, 10, 8, 8, 8].map((v, i) => row(i, v))
    const t = buildFuelInsights({ ...base, history }).find((i) => i.id === 'trend')!
    expect(t.tone).toBe('bad')
    expect(t.text).toContain('+25%')
  })

  it('counts a streak of better-than-average fill-ups', () => {
    const history = [row(0, 7, 'good'), row(1, 7, 'good'), row(2, 7, 'good'), row(3, 9, 'bad')]
    expect(buildFuelInsights({ ...base, history }).find((i) => i.id === 'streak')!.text).toContain('3 заправки подряд')
  })

  it('warns when the range is short and adds days at the current pace', () => {
    const r = buildFuelInsights({ ...base, history: [], rangeKm: 40, dailyKm: 20 }).find((i) => i.id === 'range')!
    expect(r.tone).toBe('bad')
    expect(r.text).toContain('~2 дня')
  })

  it('compares with the reference consumption only when it differs by 5% or more', () => {
    const near = buildFuelInsights({ ...base, car: { referenceConsumptionL100km: 7.9 }, history: [] })
    expect(near.map((i) => i.id)).not.toContain('reference')
    const far = buildFuelInsights({ ...base, car: { referenceConsumptionL100km: 6 }, history: [] }).find((i) => i.id === 'reference')!
    expect(far.text).toContain('выше заданного эталона')
  })

  it('never returns more than six insights', () => {
    const entries = Array.from({ length: 10 }, (_, i) => fill({ mileage: 1000 + i * 500, liters: 40, cost: 2000 + i * 200, date: 1_000_000 + i * 9 * DAY, station: i % 2 ? 'A' : 'B', fuelType: i % 2 ? 'АИ-95' : 'АИ-92' }))
    const history = [10, 10, 10, 8, 8, 8, 7, 7].map((v, i) => row(i, v, 'good'))
    const out = buildFuelInsights({ ...base, car: { referenceConsumptionL100km: 6 }, fuelEntries: entries, history, rangeKm: 30, dailyKm: 40, now: 1_000_000 + 12 * 9 * DAY })
    expect(out.length).toBeLessThanOrEqual(6)
  })
})
