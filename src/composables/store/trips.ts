import * as db from '../../db/database'
import type { Trip } from '../../types'
import { computed } from 'vue'
import { car, makeId, nowTs, trips } from './state'

export async function addTrip(input: {
  startMileage: number
  endMileage: number
  purpose: 'business' | 'personal'
  date?: number
  note?: string
}): Promise<void> {
  if (!car.value) return
  const trip: Trip = {
    id: makeId(),
    carId: car.value.id,
    date: input.date ?? nowTs(),
    startMileage: input.startMileage,
    endMileage: input.endMileage,
    purpose: input.purpose,
    note: input.note?.trim() || undefined,
  }
  trips.unshift(trip)
  await db.putTrip(trip)
}

export async function deleteTrip(id: string): Promise<Trip | null> {
  const index = trips.findIndex((t) => t.id === id)
  if (index === -1) return null
  const [removed] = trips.splice(index, 1)
  await db.deleteTrip(id)
  return removed
}

export async function restoreTrip(trip: Trip): Promise<void> {
  if (trips.some((t) => t.id === trip.id)) return
  trips.push(trip)
  await db.putTrip(trip)
}

export const totalBusinessKm = computed(() =>
  trips.filter((t) => t.purpose === 'business').reduce((sum, t) => sum + Math.max(0, t.endMileage - t.startMileage), 0),
)

export const totalPersonalKm = computed(() =>
  trips.filter((t) => t.purpose === 'personal').reduce((sum, t) => sum + Math.max(0, t.endMileage - t.startMileage), 0),
)

