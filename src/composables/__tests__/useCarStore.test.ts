import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// The store reads localStorage at import time and for the active car id.
const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
})

type Store = ReturnType<typeof import('../useCarStore').useCarStore>
let store: Store

beforeAll(async () => {
  const mod = await import('../useCarStore')
  store = mod.useCarStore()
  await store.load()
})

describe('car store', () => {
  it('does not leak documents from one car into the next', async () => {
    await store.createCar({ make: 'Ford', model: 'Focus', year: 2018, initialMileage: 1000 })
    await store.addDocument({ type: 'insurance', title: 'ОСАГО', photos: [] })
    expect(store.documents).toHaveLength(1)

    await store.createCar({ make: 'Lada', model: 'Vesta', year: 2020, initialMileage: 500 })
    expect(store.documents).toHaveLength(0)
    expect(store.expenses).toHaveLength(0)
    expect(store.historyEntries).toHaveLength(0)
  })

  it('creates owed recurring entries exactly once, even when saves overlap', async () => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth() - 2, 1).getTime()
    await Promise.all([
      store.addExpense({ category: 'parking', title: 'Парковка', amount: 3000, date: start, repeat: 'month' }),
      store.addExpense({ category: 'loan', title: 'Кредит', amount: 100, date: start, repeat: 'month' }),
    ])
    const parking = store.expenses.filter((e) => e.title === 'Парковка')
    const loan = store.expenses.filter((e) => e.title === 'Кредит')
    expect(parking).toHaveLength(3) // two months ago, last month, this month
    expect(loan).toHaveLength(3)
    expect(parking.filter((e) => e.recurrence)).toHaveLength(1)

    // Another save must not duplicate anything.
    await store.addExpense({ category: 'other', title: 'Разовый', amount: 1 })
    expect(store.expenses.filter((e) => e.title === 'Парковка')).toHaveLength(3)
  })

  it('stores a breakdown and master on a service and clears them on edit', async () => {
    const item = store.items[0]
    await store.markServiced(item.id, undefined, 900, undefined, undefined, [{ id: 'a', kind: 'part', name: 'Фильтр', amount: 400 }], 'm1')
    const entry = store.historyEntries[0]
    expect(entry.items).toHaveLength(1)
    expect(entry.masterId).toBe('m1')
    await store.updateHistoryEntry(entry.id, { itemName: entry.itemName, mileage: entry.mileage, date: entry.date, cost: 900 })
    expect(store.historyEntries[0].items).toBeUndefined()
    expect(store.historyEntries[0].masterId).toBeUndefined()
  })

  it('exports and re-imports everything including the budget', async () => {
    const backup = await store.exportData()
    expect(backup.cars.length).toBeGreaterThanOrEqual(2)
    const before = store.expenses.length
    const result = await store.importData(JSON.parse(JSON.stringify(backup)))
    expect(result).toEqual({ ok: true })
    expect(store.expenses.length).toBe(before)
  })

  it('rejects garbage without touching data', async () => {
    const before = store.expenses.length
    expect((await store.importData({ nope: true })).ok).toBe(false)
    expect((await store.importData(null)).ok).toBe(false)
    expect(store.expenses.length).toBe(before)
  })

  it('clears every list when the last car is deleted', async () => {
    for (const c of [...store.cars]) await store.deleteCar(c.id)
    expect(store.cars).toHaveLength(0)
    expect(store.documents).toHaveLength(0)
    expect(store.expenses).toHaveLength(0)
    expect(store.items).toHaveLength(0)
  })
})
