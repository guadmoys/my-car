import { describe, expect, it } from 'vitest'
import { cleanBackupRecords, type BackupRecords } from '../backup/backupValidation'

const NOW = new Date(2026, 5, 15).getTime()
const T = new Date(2026, 4, 1).getTime()

const empty = (): BackupRecords => ({ cars: [], items: [], fuel: [], history: [], reminders: [], masters: [], expenses: [], components: [], trips: [], documents: [] })
const car = (over: Record<string, unknown> = {}) => ({ id: 'c1', make: 'Ford', model: 'Focus', year: 2018, initialMileage: 1000, currentMileage: 2000, createdAt: T, updatedAt: T, ...over })

describe('cleanBackupRecords', () => {
  it('passes a healthy backup through untouched', () => {
    const input = empty()
    input.cars = [car({ tankCapacity: 50, vin: 'X' })]
    input.items = [{ id: 'i1', carId: 'c1', name: 'Масло', intervalKm: 10000, lastServiceMileage: 1000, lastServiceDate: T, isCustom: false, order: 0, parts: [] }]
    input.fuel = [{ id: 'f1', carId: 'c1', mileage: 1500, liters: 40, date: T, cost: 2000, isFullTank: true }]
    input.history = [{ id: 'h1', carId: 'c1', itemId: 'i1', itemName: 'Масло', mileage: 1000, date: T, cost: 900, items: [{ id: 'a', kind: 'part', name: 'Фильтр', amount: 400, warrantyMonths: 6 }] }]
    input.reminders = [{ id: 'r1', carId: 'c1', text: 'x', createdAt: T, dueMileage: 3000 }]
    input.masters = [{ id: 'm1', carId: 'c1', name: 'СТО', createdAt: T }]
    input.expenses = [{ id: 'e1', carId: 'c1', category: 'fine', amount: 500, date: T, recurrence: { every: 'month', anchorDay: 5 }, photos: ['data:x'] }]
    input.components = [{ id: 'k1', carId: 'c1', type: 'tires', mileage: 1500, date: T, treadDepthMm: 6 }]
    input.trips = [{ id: 't1', carId: 'c1', date: T, startMileage: 1000, endMileage: 1100, purpose: 'business' }]
    input.documents = [{ id: 'd1', carId: 'c1', type: 'insurance', photos: [], createdAt: T, expiryDate: T + 1e9 }]
    const out = cleanBackupRecords(JSON.parse(JSON.stringify(input)), NOW)
    expect(out.skipped).toBe(0)
    expect(out.cars).toEqual(input.cars)
    expect(out.items).toEqual(input.items)
    expect(out.fuel).toEqual(input.fuel)
    expect(out.history).toEqual(input.history)
    expect(out.reminders).toEqual(input.reminders)
    expect(out.expenses).toEqual(input.expenses)
    expect(out.components).toEqual(input.components)
    expect(out.trips).toEqual(input.trips)
    expect(out.documents).toEqual(input.documents)
  })

  it('drops records that are not objects or lack identifying fields, and counts them', () => {
    const input = empty()
    input.cars = [car(), null, 'oops', { make: 'NoId' }, car({ id: 'c2', year: 'abc' })]
    const out = cleanBackupRecords(input, NOW)
    expect(out.cars.map((c) => c.id)).toEqual(['c1'])
    expect(out.skipped).toBe(4)
  })

  it('rejects impossible numbers: NaN, infinity, negative mileage, absurd dates', () => {
    const input = empty()
    input.cars = [car()]
    input.fuel = [
      { id: 'ok', carId: 'c1', mileage: 1500, liters: 40, date: T },
      { id: 'nan', carId: 'c1', mileage: NaN, liters: 40, date: T },
      { id: 'inf', carId: 'c1', mileage: 1500, liters: Infinity, date: T },
      { id: 'neg', carId: 'c1', mileage: -5, liters: 40, date: T },
      { id: 'date0', carId: 'c1', mileage: 1500, liters: 40, date: 0 },
      { id: 'future', carId: 'c1', mileage: 1500, liters: 40, date: 9e15 },
      { id: 'str', carId: 'c1', mileage: '1500', liters: 40, date: T },
    ]
    const out = cleanBackupRecords(input, NOW)
    expect(out.fuel.map((f) => f.id)).toEqual(['ok'])
    expect(out.skipped).toBe(6)
  })

  it('removes a bad optional field instead of losing the whole record', () => {
    const input = empty()
    input.cars = [car()]
    input.fuel = [{ id: 'f', carId: 'c1', mileage: 1500, liters: 40, date: T, cost: 'free', station: 42, isFullTank: 'yes' }]
    const [f] = cleanBackupRecords(input, NOW).fuel
    expect(f).toBeDefined()
    expect('cost' in f || 'station' in f || 'isFullTank' in f).toBe(false)
  })

  it('drops records of cars that are not in the file, and keeps the last of repeated ids', () => {
    const input = empty()
    input.cars = [car()]
    input.expenses = [
      { id: 'e1', carId: 'ghost', category: 'fine', amount: 1, date: T },
      { id: 'dup', carId: 'c1', category: 'fine', amount: 1, date: T },
      { id: 'dup', carId: 'c1', category: 'fine', amount: 2, date: T },
    ]
    const out = cleanBackupRecords(input, NOW)
    expect(out.expenses).toHaveLength(1)
    expect(out.expenses[0].amount).toBe(2)
    expect(out.skipped).toBe(2)
  })

  it('repairs what can be repaired: unknown category, missing parts list, bad recurrence and breakdown', () => {
    const input = empty()
    input.cars = [car({ createdAt: undefined })]
    input.items = [{ id: 'i', carId: 'c1', name: 'x', intervalKm: 1000, lastServiceMileage: 0 }]
    input.expenses = [
      {
        id: 'e',
        carId: 'c1',
        category: 'martian',
        amount: 5,
        date: T,
        recurrence: { every: 'week', anchorDay: 40 },
        items: [{ id: 'a', kind: 'part', name: 'ok', amount: 1 }, { id: 'b', kind: 'wizard', name: 'bad', amount: 1 }, null],
        photos: ['p', 5, null],
      },
    ]
    input.documents = [{ id: 'd', carId: 'c1', type: 'weird', photos: 'nope' }]
    const out = cleanBackupRecords(input, NOW)
    expect(out.cars[0].createdAt).toBe(NOW)
    expect(out.items[0]).toMatchObject({ parts: [], isCustom: false, lastServiceDate: null, order: 0 })
    expect(out.expenses[0].category).toBe('other')
    expect(out.expenses[0].recurrence).toBeUndefined()
    expect(out.expenses[0].items).toHaveLength(1)
    expect(out.expenses[0].photos).toEqual(['p'])
    expect(out.documents[0]).toMatchObject({ type: 'other', photos: [] })
  })

  it('drops a reminder that could never fire', () => {
    const input = empty()
    input.cars = [car()]
    input.reminders = [{ id: 'r', carId: 'c1', text: 'x', createdAt: T }]
    expect(cleanBackupRecords(input, NOW).reminders).toEqual([])
  })

  it('does not modify the objects it was given', () => {
    const input = empty()
    const original: Record<string, unknown> = car({ vin: 5 })
    input.cars = [original]
    cleanBackupRecords(input, NOW)
    expect(original.vin).toBe(5)
  })

  it('keeps unknown fields so a newer backup is not stripped', () => {
    const input = empty()
    input.cars = [car({ futureFeature: { a: 1 } })]
    expect((cleanBackupRecords(input, NOW).cars[0] as unknown as Record<string, unknown>).futureFeature).toEqual({ a: 1 })
  })
})
