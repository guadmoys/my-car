import { describe, expect, it } from 'vitest'
import { averageDailyKm, maintenanceStatus } from '../maintenance'
import type { MaintenanceItem } from '../../types'

const DAY = 86400000
const item = (over: Partial<MaintenanceItem> = {}): MaintenanceItem => ({
  id: 'i',
  carId: 'c',
  name: 'Масло',
  intervalKm: 10000,
  lastServiceMileage: 50000,
  order: 0,
  parts: [],
  ...over,
} as MaintenanceItem)

describe('maintenanceStatus', () => {
  const now = new Date(2026, 5, 15).getTime()

  it('is ok, soon (inside 10% of the interval) and due by mileage', () => {
    expect(maintenanceStatus(item(), 52000, now, null, []).state).toBe('ok')
    expect(maintenanceStatus(item(), 59100, now, null, []).state).toBe('soon')
    expect(maintenanceStatus(item(), 60000, now, null, []).state).toBe('due')
    expect(maintenanceStatus(item(), 61500, now, null, []).remainingKm).toBe(-1500)
  })

  it('takes the worse of mileage and calendar state', () => {
    const base = item({ intervalMonths: 12, lastServiceDate: new Date(2025, 5, 1).getTime() })
    const s = maintenanceStatus(base, 51000, now, null, [])
    expect(s.state).toBe('due') // a year and two weeks since the last service, far under the km interval
    expect(s.remainingDays).toBeLessThanOrEqual(0)
    expect(s.daySoonThreshold).not.toBeNull()
  })

  it('exposes the soon thresholds, honouring explicit overrides', () => {
    const s = maintenanceStatus(item({ notifyBeforeKm: 2500 }), 51000, now, null, [])
    expect(s.kmSoonThreshold).toBe(2500)
    expect(maintenanceStatus(item(), 51000, now, null, []).kmSoonThreshold).toBe(1000)
  })

  it('estimates a due date from the driving pace, only for km-only items within three years', () => {
    const s = maintenanceStatus(item(), 55000, now, 50, [])
    expect(s.estimatedDueDate).toBeCloseTo(now + (5000 / 50) * DAY, -3)
    expect(maintenanceStatus(item(), 55000, now, 1, []).estimatedDueDate).toBeUndefined() // 5000 days away
    expect(maintenanceStatus(item(), 55000, now, null, []).estimatedDueDate).toBeUndefined()
    expect(maintenanceStatus(item({ intervalMonths: 12, lastServiceDate: now }), 55000, now, 50, []).estimatedDueDate).toBeUndefined()
  })

  it('does not blow up on a zero interval', () => {
    const s = maintenanceStatus(item({ intervalKm: 0 }), 50000, now, 50, [])
    expect(Number.isFinite(s.progress)).toBe(true)
    expect(s.state).toBe('due')
  })

  it('widens the soon threshold when history shows the user services early', () => {
    const history = [20000, 28000, 36000, 44000].map((mileage) => ({ mileage, date: 0 }))
    const s = maintenanceStatus(item(), 51000, now, null, history)
    expect(s.kmSoonThreshold).toBeGreaterThan(1000)
    expect(s.kmSoonThreshold).toBeLessThanOrEqual(4000)
  })
})

describe('averageDailyKm', () => {
  it('needs two fill-ups spread over at least three days and a growing odometer', () => {
    const t = Date.now()
    expect(averageDailyKm([])).toBeNull()
    expect(averageDailyKm([{ date: t, mileage: 1 }])).toBeNull()
    expect(averageDailyKm([{ date: t, mileage: 1000 }, { date: t + 2 * DAY, mileage: 1100 }])).toBeNull()
    expect(averageDailyKm([{ date: t, mileage: 1000 }, { date: t + 10 * DAY, mileage: 1500 }])).toBe(50)
    expect(averageDailyKm([{ date: t, mileage: 1500 }, { date: t + 10 * DAY, mileage: 1000 }])).toBeNull()
  })
})
