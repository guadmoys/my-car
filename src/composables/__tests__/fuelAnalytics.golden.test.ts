import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})

/**
 * Regression net for the fuel analytics: a fixed, varied history goes through the
 * real store and every derived number is compared with a recorded snapshot.
 * It guards the numbers across refactors, so a change here must be deliberate.
 */
const NOW = new Date(2026, 9, 3, 12, 0, 0).getTime()
const DAY = 86400000

describe('fuel analytics golden snapshot', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterAll(() => vi.useRealTimers())

  it('keeps every derived figure unchanged', async () => {
    const { useCarStore } = await import('../useCarStore')
    const store = useCarStore()
    await store.load()
    await store.createCar({ make: 'Ford', model: 'Focus', year: 2018, initialMileage: 50000 })
    await store.updateCarInfo({ tankCapacity: 50, referenceConsumptionL100km: 7 })

    const stations = ['Лукойл', 'Газпром', 'Роснефть']
    const types = ['АИ-95', 'АИ-92', 'Дизель']
    let mileage = 50000
    const rows: { liters: number; km: number; full: boolean; remaining?: number; price: number }[] = []
    // 26 fill-ups, roughly every 9 days, consumption drifting with the season, a few partials and one bad entry.
    for (let i = 0; i < 26; i++) {
      const km = 420 + ((i * 37) % 90)
      const season = [11, 0, 1].includes(new Date(NOW - (26 - i) * 9 * DAY).getMonth()) ? 1.18 : 1
      const liters = Math.round(((km * (6.8 + (i % 5) * 0.35) * season) / 100) * 10) / 10
      rows.push({ liters, km, full: i % 7 !== 3, remaining: i % 7 === 3 ? 6 : undefined, price: 50 + (i % 6) * 1.3 })
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      mileage += r.km
      await store.addFuelEntry({
        mileage: i === 20 ? mileage - 300 : mileage, // one out-of-order reading
        liters: r.liters,
        date: NOW - (26 - i) * 9 * DAY,
        cost: Math.round(r.liters * r.price),
        fuelType: types[i % 3],
        isFullTank: r.full,
        remainingLiters: r.remaining,
        station: stations[i % 3],
      })
    }
    const item = store.items[0]
    await store.markServiced(item.id, mileage - 100, 4500, undefined, NOW - 40 * DAY)
    await store.markServiced(store.items[1].id, mileage - 50, 2500, undefined, NOW - 100 * DAY)

    const snapshot = {
      averageConsumption: store.averageConsumption.value,
      history: store.fuelHistory.value.map((h) => ({
        mileage: h.entry.mileage,
        distanceKm: h.distanceKm,
        l100: h.litersPer100km,
        quality: h.quality,
      })),
      estimatedRangeKm: store.estimatedRangeKm.value,
      averageFuelPrice: store.averageFuelPrice.value,
      totalCo2Kg: store.totalCo2Kg.value,
      insights: store.fuelInsights.value,
      monthDistanceKm: store.monthDistanceKm.value,
      costForecast: store.costForecast.value,
      totals: { fuel: store.totalFuelCost.value, service: store.totalServiceCost.value, all: store.totalCost.value },
    }
    await expect(JSON.stringify(snapshot, null, 2)).toMatchFileSnapshot('./snapshots/fuelAnalytics.json')
  })
})
