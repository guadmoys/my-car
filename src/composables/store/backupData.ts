import * as db from '../../db/database'
import type {
  BackupData,
  Car,
  CarDocument,
  ComponentCheck,
  Expense,
  FuelEntry,
  HistoryEntry,
  LegacyBackupData,
  MaintenanceItem,
  Master,
  Reminder,
  Trip,
} from '../../types'
import { saveSnapshot } from '../../utils/autoBackup'
import { monthlyBudget, setMonthlyBudget } from '../../utils/budget'
import { SUPPORTED_BACKUP_VERSION, cleanBackupRecords, type BackupRecords } from '../../utils/backupValidation'
import { migrateLegacyToDocuments } from '../../utils/documents'
import {
  ACTIVE_CAR_KEY,
  activeCarId,
  bumpLoadToken,
  cars,
  componentChecks,
  documents,
  expenses,
  fuelEntries,
  historyEntries,
  isImporting,
  items,
  makeId,
  masters,
  nowTs,
  reminders,
  trips,
} from './state'

export function isMultiCarBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return Array.isArray(d.cars) && Array.isArray(d.items)
}

export function isLegacyBackup(data: unknown): data is LegacyBackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return typeof d.car === 'object' && d.car !== null && Array.isArray(d.items)
}

export async function exportData(): Promise<BackupData> {
  const [allCars, allItems, allFuel, allHistory, allReminders, allMasters, allExpenses, allComponents, allTrips, allDocuments] =
    await Promise.all([
      db.getAllCars(),
      db.getAllMaintenanceItemsRaw(),
      db.getAllFuelEntriesRaw(),
      db.getAllHistoryRaw(),
      db.getAllRemindersRaw(),
      db.getAllMastersRaw(),
      db.getAllExpensesRaw(),
      db.getAllComponentsRaw(),
      db.getAllTripsRaw(),
      db.getAllDocumentsRaw(),
    ])
  return {
    version: 2,
    exportedAt: nowTs(),
    cars: allCars,
    activeCarId: activeCarId.value,
    items: allItems,
    fuelEntries: allFuel,
    historyEntries: allHistory,
    reminders: allReminders,
    masters: allMasters,
    expenses: allExpenses,
    components: allComponents,
    trips: allTrips,
    documents: allDocuments,
    settings: monthlyBudget.value ? { monthlyBudget: monthlyBudget.value } : undefined,
  }
}

export async function importData(data: unknown): Promise<{ ok: true; skipped: number } | { ok: false; error: string }> {
  // Applied only once the import succeeded, so a rejected file can't change settings.
  const importedBudget = isMultiCarBackup(data) ? data.settings?.monthlyBudget : undefined

  let raw: BackupRecords
  let preferredActiveCarId: string | undefined

  if (isMultiCarBackup(data)) {
    const version = (data as { version?: unknown }).version
    if (typeof version === 'number' && version > SUPPORTED_BACKUP_VERSION) {
      return { ok: false, error: 'Копия создана более новой версией приложения — обновите приложение и повторите' }
    }
    const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
    raw = {
      cars: data.cars,
      items: data.items,
      fuel: list(data.fuelEntries),
      history: list(data.historyEntries),
      reminders: list(data.reminders),
      masters: list(data.masters),
      expenses: list(data.expenses),
      components: list(data.components),
      trips: list(data.trips),
      documents: list(data.documents),
    }
    preferredActiveCarId = typeof data.activeCarId === 'string' ? data.activeCarId : undefined
  } else if (isLegacyBackup(data)) {
    const carId = data.car.id && data.car.id !== 'main' ? data.car.id : makeId()
    const withCar = (rows: unknown): unknown[] =>
      (Array.isArray(rows) ? rows : []).map((r) => (typeof r === 'object' && r !== null ? { ...r, carId } : r))
    raw = {
      cars: [{ ...data.car, id: carId }],
      items: withCar(data.items),
      fuel: withCar(data.fuelEntries),
      history: withCar(data.historyEntries),
      reminders: [],
      masters: [],
      expenses: [],
      components: [],
      trips: [],
      documents: [],
    }
    preferredActiveCarId = carId
  } else {
    return { ok: false, error: 'Файл повреждён или это не резервная копия «Моей машины»' }
  }

  // Nothing in a backup file is trusted: damaged records are dropped (and counted) instead of
  // reaching the database, where a missing id or a NaN mileage would break the app later.
  const clean = cleanBackupRecords(raw, nowTs())
  let importedCars: Car[] = clean.cars
  const importedItems: MaintenanceItem[] = clean.items
  const importedFuel: FuelEntry[] = clean.fuel
  const importedHistory: HistoryEntry[] = clean.history
  const importedReminders: Reminder[] = clean.reminders
  const importedMasters: Master[] = clean.masters
  let importedExpenses: Expense[] = clean.expenses
  const importedComponents: ComponentCheck[] = clean.components
  const importedTrips: Trip[] = clean.trips
  let importedDocuments: CarDocument[] = clean.documents
  const newActiveCarId =
    preferredActiveCarId && importedCars.some((c) => c.id === preferredActiveCarId) ? preferredActiveCarId : importedCars[0]?.id

  if (!newActiveCarId || importedCars.length === 0) {
    return { ok: false, error: 'В файле нет ни одной машины' }
  }

  // Backups from before the Documents section still carry the STS number,
  // car photos and expense renewal dates; move them over the same way the
  // startup migration does so they aren't lost or shown twice.
  const migration = migrateLegacyToDocuments(importedCars, importedExpenses, importedDocuments, nowTs())
  if (migration.documents.length > 0 || migration.cars.length > 0 || migration.expenses.length > 0) {
    importedDocuments = [...importedDocuments, ...migration.documents]
    importedCars = importedCars.map((c) => migration.cars.find((m) => m.id === c.id) ?? c)
    importedExpenses = importedExpenses.map((e) => migration.expenses.find((m) => m.id === e.id) ?? e)
  }

  // Keep a copy of what's about to be overwritten so a bad file or cloud
  // restore can be undone from Settings → «Автокопии».
  try {
    await saveSnapshot(await exportData(), 'before-import')
  } catch {
    /* a failed safety copy must not block the import itself */
  }

  // Set before the write so a watcher-driven auto-sync can't export a
  // half-replaced database over the cloud backup while this is in flight.
  isImporting.value = true
  try {
    await db.replaceAll({
      cars: importedCars,
      items: importedItems,
      fuel: importedFuel,
      history: importedHistory,
      reminders: importedReminders,
      masters: importedMasters,
      expenses: importedExpenses,
      components: importedComponents,
      trips: importedTrips,
      documents: importedDocuments,
    })

    // The whole DB was just replaced wholesale — any loadCarData still in
    // flight for the previous state must not be allowed to apply afterwards.
    bumpLoadToken()

    cars.splice(0, cars.length, ...importedCars)
    activeCarId.value = newActiveCarId
    localStorage.setItem(ACTIVE_CAR_KEY, newActiveCarId)

    items.splice(0, items.length, ...importedItems.filter((i) => i.carId === newActiveCarId))
    fuelEntries.splice(0, fuelEntries.length, ...importedFuel.filter((f) => f.carId === newActiveCarId))
    historyEntries.splice(
      0,
      historyEntries.length,
      ...importedHistory.filter((h) => h.carId === newActiveCarId),
    )
    reminders.splice(0, reminders.length, ...importedReminders.filter((r) => r.carId === newActiveCarId))
    masters.splice(0, masters.length, ...importedMasters.filter((m) => m.carId === newActiveCarId))
    expenses.splice(0, expenses.length, ...importedExpenses.filter((e) => e.carId === newActiveCarId))
    componentChecks.splice(0, componentChecks.length, ...importedComponents.filter((c) => c.carId === newActiveCarId))
    trips.splice(0, trips.length, ...importedTrips.filter((t) => t.carId === newActiveCarId))
    documents.splice(0, documents.length, ...importedDocuments.filter((d) => d.carId === newActiveCarId))
  } finally {
    isImporting.value = false
  }

  if (typeof importedBudget === 'number') setMonthlyBudget(importedBudget)
  return { ok: true, skipped: clean.skipped }
}

