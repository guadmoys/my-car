import * as db from '../../db/database'
import type { FuelEntry } from '../../types'
import { updateMileage } from './car'
import { car, fuelEntries, makeId, nowTs } from './state'

export async function addFuelEntry(input: {
  mileage: number
  liters: number
  date?: number
  cost?: number
  fuelType?: string
  isFullTank?: boolean
  remainingLiters?: number
  station?: string
  comment?: string
  receiptPhoto?: string
}): Promise<void> {
  if (!car.value) return
  const carId = car.value.id
  const entry: FuelEntry = {
    id: makeId(),
    carId,
    mileage: input.mileage,
    liters: input.liters,
    date: input.date ?? nowTs(),
    cost: input.cost,
    fuelType: input.fuelType,
    isFullTank: input.isFullTank,
    remainingLiters: input.remainingLiters,
    station: input.station,
    comment: input.comment,
    receiptPhoto: input.receiptPhoto,
  }
  fuelEntries.push(entry)
  await db.putFuelEntry(entry)

  // Re-check the active car survived the await (the user may have switched
  // cars while this write was in flight) and pass the entry's own date so a
  // backdated fill-up can't masquerade as a live "now" mileage reading.
  if (car.value?.id === carId && input.mileage > car.value.currentMileage) {
    await updateMileage(input.mileage, entry.date)
  }
}

export async function deleteFuelEntry(id: string): Promise<FuelEntry | null> {
  const index = fuelEntries.findIndex((e) => e.id === id)
  if (index === -1) return null
  const [removed] = fuelEntries.splice(index, 1)
  await db.deleteFuelEntry(id)
  return removed
}

export async function restoreFuelEntry(entry: FuelEntry): Promise<void> {
  if (fuelEntries.some((e) => e.id === entry.id)) return
  fuelEntries.push(entry)
  await db.putFuelEntry(entry)
}

export async function updateFuelEntry(
  id: string,
  input: {
    mileage: number
    liters: number
    date: number
    cost?: number
    fuelType?: string
    isFullTank?: boolean
    remainingLiters?: number
    station?: string
    comment?: string
    receiptPhoto?: string
  },
): Promise<void> {
  const entry = fuelEntries.find((e) => e.id === id)
  if (!entry) return
  const carId = entry.carId
  entry.mileage = input.mileage
  entry.liters = input.liters
  entry.date = input.date
  entry.cost = input.cost ?? undefined
  entry.fuelType = input.fuelType
  entry.isFullTank = input.isFullTank
  entry.remainingLiters = input.remainingLiters
  entry.station = input.station
  entry.comment = input.comment
  entry.receiptPhoto = input.receiptPhoto
  await db.putFuelEntry({ ...entry })

  if (car.value?.id === carId && input.mileage > car.value.currentMileage) {
    await updateMileage(input.mileage, input.date)
  }
}

