import { describe, expect, it } from 'vitest'
import { atMorning, computeAlerts, groupIntoNotes, type CarBundle } from '../alerts/alerts'
import type { Car, MaintenanceItem } from '../../types'

const DAY = 86400000
const NOW = new Date(2026, 5, 15, 14, 0).getTime()

const car = (over: Partial<Car> = {}): Car => ({ id: 'c1', make: 'Ford', model: 'Focus', year: 2018, initialMileage: 0, currentMileage: 55000, createdAt: 0, updatedAt: 0, ...over }) as Car
const item = (over: Partial<MaintenanceItem> = {}): MaintenanceItem =>
  ({ id: 'oil', carId: 'c1', name: 'Масло', intervalKm: 10000, lastServiceMileage: 50000, order: 0, parts: [], ...over }) as MaintenanceItem
const bundle = (over: Partial<CarBundle> = {}): CarBundle => ({ car: car(), items: [], history: [], fuel: [], reminders: [], documents: [], expenses: [], ...over })

describe('service alerts', () => {
  it('raises "due" for an overdue item and "soon" inside the lead', () => {
    const due = computeAlerts([bundle({ items: [item({ lastServiceMileage: 40000 })] })], NOW)
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ stage: 'due', kind: 'service', title: 'Масло' })
    expect(due[0].body.replace(/\s/g, ' ')).toBe('Просрочено на 5 000 км')

    const soon = computeAlerts([bundle({ car: car({ currentMileage: 59200 }), items: [item()] })], NOW)
    expect(soon.find((a) => a.stage === 'soon')?.body).toContain('осталось ~800 км')
  })

  it('stays quiet for an item that is fine', () => {
    expect(computeAlerts([bundle({ items: [item()] })], NOW).filter((a) => a.at <= NOW)).toEqual([])
  })

  it('changes identity after servicing, so the next alert is new', () => {
    const before = computeAlerts([bundle({ items: [item({ lastServiceMileage: 40000 })] })], NOW)[0].key
    const after = computeAlerts([bundle({ car: car({ currentMileage: 70000 }), items: [item({ lastServiceMileage: 60000 })] })], NOW)[0].key
    expect(after).not.toBe(before)
  })

  it('schedules date-driven alerts ahead at nine in the morning', () => {
    const last = new Date(2025, 8, 1).getTime()
    const b = bundle({ items: [item({ intervalMonths: 12, lastServiceDate: last })] })
    const future = computeAlerts([b], NOW).filter((a) => a.at > NOW)
    const dueAt = atMorning(new Date(2026, 8, 1).getTime())
    expect(future.find((a) => a.stage === 'due')?.at).toBe(dueAt)
    const soon = future.find((a) => a.stage === 'soon')!
    expect(soon.at).toBeLessThan(dueAt)
    expect(new Date(soon.at).getHours()).toBe(9)
    expect(future.every((a) => !a.approximate)).toBe(true)
  })

  it('marks pace-based schedule entries as approximate', () => {
    const fuel = [
      { id: 'a', carId: 'c1', mileage: 54000, liters: 40, date: NOW - 20 * DAY },
      { id: 'b', carId: 'c1', mileage: 55000, liters: 40, date: NOW },
    ] as never[]
    const alerts = computeAlerts([bundle({ fuel, items: [item()] })], NOW).filter((a) => a.at > NOW)
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.every((a) => a.approximate)).toBe(true)
  })
})

describe('reminders and documents', () => {
  it('fires a dated reminder at its own time and a day-only one in the morning', () => {
    const at = new Date(2026, 5, 20, 14, 30).getTime()
    const [timed] = computeAlerts([bundle({ reminders: [{ id: 'r', carId: 'c1', text: 'Запись', createdAt: 0, dueDate: at, hasTime: true }] })], NOW)
    expect(timed.at).toBe(at)
    const [dayOnly] = computeAlerts([bundle({ reminders: [{ id: 'r2', carId: 'c1', text: 'Шины', createdAt: 0, dueDate: new Date(2026, 5, 20, 9, 0).getTime() }] })], NOW)
    expect(new Date(dayOnly.at).getHours()).toBe(9)
  })

  it('treats a reached odometer reminder as due now', () => {
    const [a] = computeAlerts([bundle({ reminders: [{ id: 'r', carId: 'c1', text: 'Масло', createdAt: 0, dueMileage: 54000 }] })], NOW)
    expect(a.at).toBe(NOW)
    expect(computeAlerts([bundle({ reminders: [{ id: 'r', carId: 'c1', text: 'x', createdAt: 0, dueMileage: 56000 }] })], NOW)).toEqual([])
  })

  it('warns 30 days before a document expires and again when it has', () => {
    const expiry = new Date(2026, 6, 10).getTime() // 25 days away
    const alerts = computeAlerts([bundle({ documents: [{ id: 'd', carId: 'c1', type: 'insurance', title: 'ОСАГО', photos: [], createdAt: 0, expiryDate: expiry }] })], NOW)
    const soon = alerts.find((a) => a.stage === 'soon')!
    expect(soon.at).toBeLessThanOrEqual(NOW)
    expect(soon.body).toBe('Срок действия истекает через 25 дней')
    expect(alerts.find((a) => a.stage === 'due')!.at).toBeGreaterThan(NOW)
    // Renewing (a new expiry date) yields new keys.
    const renewed = computeAlerts([bundle({ documents: [{ id: 'd', carId: 'c1', type: 'insurance', title: 'ОСАГО', photos: [], createdAt: 0, expiryDate: expiry + 365 * DAY }] })], NOW)
    expect(renewed.map((a) => a.key)).not.toContain(soon.key)
  })

  it('reports an expired document as due', () => {
    const [a] = computeAlerts([bundle({ documents: [{ id: 'd', carId: 'c1', type: 'tax', photos: [], createdAt: 0, expiryDate: NOW - 3 * DAY }] })], NOW)
    expect(a).toMatchObject({ stage: 'due', body: 'Срок действия истёк' })
  })
})

describe('several cars and grouping', () => {
  it('prefixes titles with the car only when there is more than one', () => {
    const one = computeAlerts([bundle({ items: [item({ lastServiceMileage: 40000 })] })], NOW)[0]
    expect(one.title).toBe('Масло')
    const lada = bundle({ car: car({ id: 'c2', make: 'Lada', model: 'Vesta', currentMileage: 99000 }), items: [item({ id: 'x', carId: 'c2', lastServiceMileage: 80000, name: 'Ремень' })] })
    const two = computeAlerts([bundle({ items: [item({ lastServiceMileage: 40000 })] }), lada], NOW)
    expect(two.map((a) => a.title).sort()).toEqual(['Ford Focus: Масло', 'Lada Vesta: Ремень'])
    expect(new Set(two.map((a) => a.key)).size).toBe(2)
  })

  it('merges same-moment alerts of one car into one note, never across cars', () => {
    const items = [item({ id: 'a', name: 'Масло', lastServiceMileage: 40000 }), item({ id: 'b', name: 'Фильтр', lastServiceMileage: 40000 })]
    const lada = bundle({ car: car({ id: 'c2', make: 'Lada', model: 'Vesta', currentMileage: 99000 }), items: [item({ id: 'x', carId: 'c2', lastServiceMileage: 80000, name: 'Ремень' })] })
    const alerts = computeAlerts([bundle({ items }), lada], NOW)
    const notes = groupIntoNotes(alerts, new Map([['c1', 'Ford Focus'], ['c2', 'Lada Vesta']]))
    expect(notes).toHaveLength(2)
    const ford = notes.find((n) => n.carId === 'c1')!
    expect(ford.title).toBe('Ford Focus: 2 дела')
    expect(ford.memberKeys).toHaveLength(2)
    expect(ford.body).toContain('Масло')
    expect(ford.body).toContain('Фильтр')
  })
})
