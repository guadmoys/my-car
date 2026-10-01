import { describe, expect, it } from 'vitest'
import type { Car, FuelEntry, HistoryEntry } from '../../types'
import { mileageAnchors, mileageInputSeed, plausibleMileageRange } from '../mileage'

const car = {
  id: 'c1',
  make: 'Audi',
  model: 'A3',
  year: 2020,
  initialMileage: 10000,
  currentMileage: 15000,
  createdAt: 1000,
  updatedAt: 5000,
} as Car

const fuel = [{ id: 'f1', carId: 'c1', mileage: 12000, liters: 40, date: 2000 }] as FuelEntry[]
const history = [{ id: 'h1', carId: 'c1', itemId: 'i', itemName: 'Масло', mileage: 14000, date: 3000 }] as HistoryEntry[]

describe('mileageInputSeed', () => {
  it('drops the last three digits', () => {
    expect(mileageInputSeed(45678)).toBe('45')
    expect(mileageInputSeed(1000)).toBe('1')
  })
  it('is blank below 1000 km', () => {
    expect(mileageInputSeed(999)).toBe('')
  })
})

describe('mileageAnchors', () => {
  it('includes the current reading only when asOf is not before the last update', () => {
    expect(mileageAnchors(car, fuel, history, 6000)).toHaveLength(4)
    expect(mileageAnchors(car, fuel, history, 4000)).toHaveLength(3)
  })
})

describe('plausibleMileageRange', () => {
  const anchors = mileageAnchors(car, fuel, history, 6000)

  it('uses the highest earlier reading as the minimum', () => {
    const range = plausibleMileageRange(anchors, 3500)
    expect(range.min).toBe(14000)
    expect(range.max).toBe(15000)
  })

  it('has no upper bound after the newest record', () => {
    const range = plausibleMileageRange(anchors, 9000)
    expect(range.min).toBe(15000)
    expect(range.max).toBeNull()
  })

  it('falls back to zero with no earlier anchor', () => {
    const range = plausibleMileageRange(anchors, 10)
    expect(range.min).toBe(0)
    expect(range.minAt).toBeNull()
    expect(range.max).toBe(10000)
  })
})
