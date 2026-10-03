import { buildDefaultItems } from '../../data/defaultMaintenance'
import * as db from '../../db/database'
import type { Car } from '../../types'
import { dailySnapshotDue, saveSnapshot } from '../../utils/backup/autoBackup'
import { migrateLegacyToDocuments } from '../../utils/documents'
import { exportData } from './backupData'
import { applyRecurringExpenses } from './expenses'
import {
  ACTIVE_CAR_KEY,
  activeCarId,
  bumpLoadToken,
  car,
  cars,
  componentChecks,
  currentLoadToken,
  documents,
  expenses,
  fuelEntries,
  historyEntries,
  isLoaded,
  items,
  makeId,
  masters,
  nowTs,
  patchCar,
  reminders,
  trips,
} from './state'

export async function loadCarData(carId: string): Promise<void> {
  const token = bumpLoadToken()
  const [loadedItems, loadedFuel, loadedHistory, loadedReminders, loadedMasters, loadedExpenses, loadedComponents, loadedTrips, loadedDocuments] =
    await Promise.all([
      db.getMaintenanceItemsForCar(carId),
      db.getFuelEntriesForCar(carId),
      db.getHistoryForCar(carId),
      db.getRemindersForCar(carId),
      db.getMastersForCar(carId),
      db.getExpensesForCar(carId),
      db.getComponentsForCar(carId),
      db.getTripsForCar(carId),
      db.getDocumentsForCar(carId),
    ])
  if (token !== currentLoadToken()) return
  items.splice(0, items.length, ...loadedItems.map((item) => ({ ...item, parts: item.parts ?? [] })))
  fuelEntries.splice(0, fuelEntries.length, ...loadedFuel)
  historyEntries.splice(0, historyEntries.length, ...loadedHistory)
  reminders.splice(0, reminders.length, ...loadedReminders)
  masters.splice(0, masters.length, ...loadedMasters)
  expenses.splice(0, expenses.length, ...loadedExpenses)
  await applyRecurringExpenses()
  componentChecks.splice(0, componentChecks.length, ...loadedComponents)
  trips.splice(0, trips.length, ...loadedTrips)
  documents.splice(0, documents.length, ...loadedDocuments)
}

/**
 * One-time (and idempotent) move of document-like data into the Documents
 * section: the car's STS number and photo gallery, and expense renewal
 * dates. A safety snapshot is taken first, since this rewrites cars/expenses.
 */
export async function migrateLegacyDocuments(): Promise<void> {
  const [allCars, allExpenses, allDocs] = await Promise.all([
    db.getAllCars(),
    db.getAllExpensesRaw(),
    db.getAllDocumentsRaw(),
  ])
  const migration = migrateLegacyToDocuments(allCars, allExpenses, allDocs, nowTs())
  if (migration.cars.length === 0 && migration.expenses.length === 0 && migration.documents.length === 0) return
  try {
    await saveSnapshot(await exportData(), 'before-migration')
  } catch {
    /* a failed safety copy must not block the migration */
  }
  // Documents first: if anything below fails, the source fields are still
  // there and the next launch retries (ids are deterministic, so no duplicates).
  await db.putDocuments(migration.documents)
  for (const c of migration.cars) await db.putCar(c)
  for (const e of migration.expenses) await db.putExpense(e)
}

export async function load(): Promise<void> {
  await migrateLegacyDocuments()
  const loadedCars = await db.getAllCars()
  cars.splice(0, cars.length, ...loadedCars)

  if (cars.length > 0) {
    const stored = localStorage.getItem(ACTIVE_CAR_KEY)
    const validStored = stored && cars.some((c) => c.id === stored) ? stored : null
    const nextActiveId = validStored ?? cars[0].id
    activeCarId.value = nextActiveId
    localStorage.setItem(ACTIVE_CAR_KEY, nextActiveId)
    await loadCarData(nextActiveId)
  }

  isLoaded.value = true

  // Rolling local safety copy (at most one per day), taken off the critical path.
  if (cars.length > 0) {
    void dailySnapshotDue()
      .then(async (due) => {
        if (due) await saveSnapshot(await exportData(), 'daily')
      })
      .catch(() => {})
  }
}

export async function switchCar(carId: string): Promise<void> {
  if (carId === activeCarId.value) return
  if (!cars.some((c) => c.id === carId)) return
  activeCarId.value = carId
  localStorage.setItem(ACTIVE_CAR_KEY, carId)
  await loadCarData(carId)
}

export async function createCar(input: {
  make: string
  model: string
  year: number
  initialMileage: number
}): Promise<void> {
  const newCar: Car = {
    id: makeId(),
    make: input.make.trim(),
    model: input.model.trim(),
    year: input.year,
    initialMileage: input.initialMileage,
    currentMileage: input.initialMileage,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  }
  const defaults = buildDefaultItems(input.initialMileage, newCar.id)

  await db.putCar(newCar)
  await db.putMaintenanceItems(defaults)

  // Cancel any in-flight loadCarData (e.g. a switchCar the user triggered
  // just before creating this car) so it can't resolve afterwards and
  // overwrite the new car's freshly-set state with a different car's data.
  bumpLoadToken()

  cars.push(newCar)
  activeCarId.value = newCar.id
  localStorage.setItem(ACTIVE_CAR_KEY, newCar.id)
  items.splice(0, items.length, ...defaults)
  fuelEntries.splice(0, fuelEntries.length)
  historyEntries.splice(0, historyEntries.length)
  reminders.splice(0, reminders.length)
  masters.splice(0, masters.length)
  expenses.splice(0, expenses.length)
  componentChecks.splice(0, componentChecks.length)
  trips.splice(0, trips.length)
  documents.splice(0, documents.length)
}

export async function deleteCar(carId: string): Promise<void> {
  await db.deleteCarCascade(carId)
  const idx = cars.findIndex((c) => c.id === carId)
  if (idx !== -1) cars.splice(idx, 1)

  if (activeCarId.value !== carId) return

  const next = cars[0] ?? null
  if (next) {
    activeCarId.value = next.id
    localStorage.setItem(ACTIVE_CAR_KEY, next.id)
    await loadCarData(next.id)
  } else {
    bumpLoadToken()
    activeCarId.value = null
    localStorage.removeItem(ACTIVE_CAR_KEY)
    items.splice(0, items.length)
    fuelEntries.splice(0, fuelEntries.length)
    historyEntries.splice(0, historyEntries.length)
    reminders.splice(0, reminders.length)
    masters.splice(0, masters.length)
    expenses.splice(0, expenses.length)
    componentChecks.splice(0, componentChecks.length)
    trips.splice(0, trips.length)
    documents.splice(0, documents.length)
  }
}

export async function updateCarInfo(
  patch: Partial<
    Pick<
      Car,
      'make' | 'model' | 'year' | 'tankCapacity' | 'vin' | 'licensePlate' | 'referenceConsumptionL100km'
    >
  >,
): Promise<void> {
  if (!activeCarId.value) return
  const updated = patchCar(activeCarId.value, patch)
  if (updated) await db.putCar(updated)
}

/**
 * `date` lets a reading be logged with the time it was actually taken (e.g.
 * backfilling an odometer check from a few days ago, or any earlier date)
 * instead of always stamping `updatedAt` with "now".
 *
 * `allowDecrease` skips the floor at `initialMileage` — set only after the
 * caller has explicitly confirmed a genuine odometer rollback (a replaced
 * cluster, a corrected earlier mistake). Without it, a lower reading is
 * clamped up to `initialMileage` as a last-resort safety net.
 *
 * A `date` older than the car's current `updatedAt` can never be the newest
 * mileage fact on record — `mileageAnchors` already excludes `currentMileage`
 * from validation in exactly this case, treating it as the value being
 * corrected rather than a fact to check against. Applying such a backdated
 * entry here anyway would move `currentMileage`/`updatedAt` backwards and
 * corrupt every status computed from them (maintenance items look "undone",
 * consumption looks negative, etc.), so it's a no-op instead. Returns
 * whether the entry was actually applied, so the caller can tell the user
 * why nothing changed.
 */
export async function updateMileage(
  newMileage: number,
  date?: number,
  options?: { allowDecrease?: boolean },
): Promise<boolean> {
  if (!car.value) return false
  if (date !== undefined && date < car.value.updatedAt) return false
  const clamped = options?.allowDecrease ? newMileage : Math.max(newMileage, car.value.initialMileage)
  const updated = patchCar(car.value.id, {
    currentMileage: clamped,
    ...(date !== undefined ? { updatedAt: date } : {}),
  })
  if (updated) await db.putCar(updated)
  return true
}

