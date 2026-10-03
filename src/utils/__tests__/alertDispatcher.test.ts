import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})

import { runAlertCycle } from '../alertDispatcher'
import { readSchedule, readShown, resetAlertStore } from '../alertStore'
import type { CarBundle } from '../alerts'
import type { Car, MaintenanceItem } from '../../types'

const DAY = 86400000
const NOW = new Date(2026, 5, 15, 14, 0).getTime()
const car = (over: Partial<Car> = {}): Car => ({ id: 'c1', make: 'Ford', model: 'Focus', year: 2018, initialMileage: 0, currentMileage: 55000, createdAt: 0, updatedAt: 0, ...over }) as Car
const item = (over: Partial<MaintenanceItem> = {}): MaintenanceItem =>
  ({ id: 'oil', carId: 'c1', name: 'Масло', intervalKm: 10000, lastServiceMileage: 50000, order: 0, parts: [], ...over }) as MaintenanceItem
const bundle = (over: Partial<CarBundle> = {}): CarBundle => ({ car: car(), items: [], history: [], fuel: [], reminders: [], documents: [], expenses: [], ...over })

function harness() {
  const sent: { title: string; body: string }[] = []
  return {
    sent,
    run: (bundles: CarBundle[], now: number, canNotify = true) =>
      runAlertCycle({ now, canNotify, loadBundles: async () => bundles, notify: async (title, body) => void sent.push({ title, body }) }),
  }
}

beforeEach(async () => {
  memory.clear()
  await resetAlertStore()
})

describe('alert cycle', () => {
  it('stays silent about what was already due on the very first run', async () => {
    const h = harness()
    const overdue = bundle({ items: [item({ lastServiceMileage: 40000 })] })
    const r = await h.run([overdue], NOW)
    expect(r.delivered).toBe(0)
    expect(h.sent).toEqual([])
    expect((await readShown()).size).toBe(1)
    // And it is not repeated later either.
    expect((await h.run([overdue], NOW + DAY)).delivered).toBe(0)
  })

  it('delivers a newly due item exactly once, then again when it escalates', async () => {
    const h = harness()
    await h.run([bundle({ items: [item()] })], NOW) // baseline: all fine
    expect((await h.run([bundle({ car: car({ currentMileage: 59200 }), items: [item()] })], NOW + DAY)).delivered).toBe(1)
    expect(h.sent[0].body).toContain('Скоро ТО')
    expect((await h.run([bundle({ car: car({ currentMileage: 59300 }), items: [item()] })], NOW + 2 * DAY)).delivered).toBe(0)
    expect((await h.run([bundle({ car: car({ currentMileage: 60100 }), items: [item()] })], NOW + 3 * DAY)).delivered).toBe(1)
    expect(h.sent[1].body).toContain('Просрочено')
    // After servicing, the next time it comes due is a new alert.
    const serviced = item({ lastServiceMileage: 60100 })
    await h.run([bundle({ car: car({ currentMileage: 60200 }), items: [serviced] })], NOW + 4 * DAY)
    expect((await h.run([bundle({ car: car({ currentMileage: 70200 }), items: [serviced] })], NOW + 40 * DAY)).delivered).toBe(1)
  })

  it('checks every car, not just one, and merges per car', async () => {
    const h = harness()
    const ford = bundle({ items: [item()] })
    const lada = bundle({ car: car({ id: 'c2', make: 'Lada', model: 'Vesta', currentMileage: 70000 }), items: [item({ id: 'x', carId: 'c2', name: 'Ремень', lastServiceMileage: 69000 })] })
    await h.run([ford, lada], NOW)
    const later = [bundle({ car: car({ currentMileage: 61000 }), items: [item()] }), { ...lada, car: car({ id: 'c2', make: 'Lada', model: 'Vesta', currentMileage: 80500 }) }]
    expect((await h.run(later, NOW + DAY)).delivered).toBe(2)
    expect(h.sent.map((s) => s.title).sort()).toEqual(['Ford Focus: Масло', 'Lada Vesta: Ремень'])
  })

  it('does not mark anything as shown while notifications are off, so they arrive once enabled', async () => {
    const h = harness()
    await h.run([bundle({ items: [item()] })], NOW)
    const due = bundle({ car: car({ currentMileage: 61000 }), items: [item()] })
    expect((await h.run([due], NOW + DAY, false)).delivered).toBe(0)
    expect(h.sent).toEqual([])
    expect((await h.run([due], NOW + 2 * DAY, true)).delivered).toBe(1)
  })

  it('does not announce a document that was added long after it expired', async () => {
    const h = harness()
    await h.run([bundle()], NOW)
    const old = bundle({ documents: [{ id: 'd', carId: 'c1', type: 'tax', photos: [], createdAt: 0, expiryDate: NOW - 200 * DAY }] })
    expect((await h.run([old], NOW + DAY)).delivered).toBe(0)
    const recent = bundle({ documents: [{ id: 'd2', carId: 'c1', type: 'tax', photos: [], createdAt: 0, expiryDate: NOW - 2 * DAY }] })
    expect((await h.run([recent], NOW + DAY)).delivered).toBe(1)
  })

  it('writes the upcoming notifications for the background check, and drops them once shown', async () => {
    const h = harness()
    const reminder = { id: 'r', carId: 'c1', text: 'Запись в сервис', createdAt: 0, dueDate: new Date(2026, 5, 20, 14, 30).getTime(), hasTime: true }
    const b = bundle({ reminders: [reminder] })
    await h.run([b], NOW)
    let schedule = await readSchedule()
    expect(schedule).toHaveLength(1)
    expect(schedule[0]).toMatchObject({ title: 'Напоминание', body: 'Запись в сервис', at: reminder.dueDate })
    // The reminder time passes and the page delivers it; it leaves the schedule.
    expect((await h.run([b], reminder.dueDate + 60_000)).delivered).toBe(1)
    schedule = await readSchedule()
    expect(schedule).toEqual([])
  })

  it('never writes notification texts to the schedule while encryption is on', async () => {
    memory.set('my-car-vault-v1', JSON.stringify({ v: 1, kdf: {}, pass: {}, recovery: {}, createdAt: 1 }))
    const h = harness()
    const reminder = { id: 'r', carId: 'c1', text: 'Секретная запись', createdAt: 0, dueDate: new Date(2026, 5, 20, 14, 30).getTime(), hasTime: true }
    await h.run([bundle({ reminders: [reminder] })], NOW)
    expect(await readSchedule()).toEqual([])
  })

  it('clears the schedule when there are no cars', async () => {
    const h = harness()
    await h.run([bundle({ reminders: [{ id: 'r', carId: 'c1', text: 'x', createdAt: 0, dueDate: NOW + DAY }] })], NOW)
    expect((await readSchedule()).length).toBe(1)
    await h.run([], NOW)
    expect(await readSchedule()).toEqual([])
  })
})
