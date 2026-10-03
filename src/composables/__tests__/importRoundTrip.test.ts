import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})

describe('records the app itself creates survive the import validator', () => {
  it('keeps every kind of record, byte for byte', async () => {
    const { useCarStore } = await import('../useCarStore')
    const store = useCarStore()
    await store.load()
    const day = 86400000
    await store.createCar({ make: 'Ford', model: 'Focus', year: 2018, initialMileage: 1000 })
    await store.updateCarInfo({ tankCapacity: 50, vin: 'WF0XXX', licensePlate: 'А123ВС', referenceConsumptionL100km: 7 })
    await store.addFuelEntry({ mileage: 1500, liters: 40, cost: 2000, fuelType: 'АИ-95', isFullTank: false, remainingLiters: 5, station: 'Лукойл', comment: 'ok', date: Date.now() - 9 * day })
    await store.markServiced(store.items[0].id, 1600, 900, undefined, Date.now() - 5 * day, [{ id: 'a', kind: 'part', name: 'Фильтр', amount: 400, warrantyMonths: 12 }], 'm1')
    await store.addCustomItem({ name: 'Свой пункт', intervalKm: 5000, intervalMonths: 6 })
    await store.addReminder({ text: 'Через 300 км', dueMileage: 1900 })
    await store.addReminder({ text: 'Записаться', dueDate: Date.now() + 3 * day, hasTime: true })
    await store.addMaster({ name: 'СТО', phone: '+7 900', specialty: 'Кузов' })
    await store.addExpense({ category: 'damage', title: 'Бампер', amount: 45000, items: [{ id: 'p', kind: 'part', name: 'Бампер', amount: 30000 }], photos: ['data:image/jpeg;base64,AA'], repeat: 'month', date: Date.now() - 2 * day })
    await store.addDocument({ type: 'insurance', title: 'ОСАГО', number: '123', expiryDate: Date.now() + 100 * day, photos: [] })
    await store.addComponentCheck({ type: 'tires', mileage: 1600, season: 'winter', treadDepthMm: 6, pressureFront: 2.3, pressureRear: 2.2 })
    await store.addTrip({ startMileage: 1500, endMileage: 1600, purpose: 'business', note: 'клиент' })

    const exported = JSON.parse(JSON.stringify(await store.exportData()))
    const result = await store.importData(JSON.parse(JSON.stringify(exported)))
    expect(result).toEqual({ ok: true, skipped: 0 })

    const again = JSON.parse(JSON.stringify(await store.exportData()))
    for (const key of ['cars', 'items', 'fuelEntries', 'historyEntries', 'reminders', 'masters', 'expenses', 'components', 'trips', 'documents'] as const) {
      expect(again[key], key).toEqual(exported[key])
      expect(exported[key].length, `${key} had data to lose`).toBeGreaterThan(0)
    }
  })
})
