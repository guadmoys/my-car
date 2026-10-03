import { computed, reactive, ref } from 'vue'
import { currency } from '../utils/currency'
import { dailySnapshotDue, saveSnapshot } from '../utils/autoBackup'
import { monthlyBudget, setMonthlyBudget } from '../utils/budget'
import { averageDailyKm, maintenanceStatus } from '../utils/maintenance'
import {
  analyzeConsumption,
  averageFuelPrice,
  buildFuelInsights,
  estimatedRange,
  forecastCosts,
  monthDistance,
  totalCo2Kg,
  type ConsumptionAnalysis,
} from '../utils/fuelAnalytics'
import { materializeRecurring } from '../utils/recurring'
import { documentStatuses as buildDocumentStatuses, migrateLegacyToDocuments } from '../utils/documents'
import type {
  BackupData,
  CarDocument,
  DocumentStatus,
  DocumentType,
  Car,
  ComponentCheck,
  ComponentType,
  CostForecast,
  Expense,
  ExpenseItem,
  ExpensePayload,
  FuelConsumption,
  FuelEntry,
  FuelInsight,
  HistoryEntry,
  LegacyBackupData,
  MaintenanceItem,
  MaintenanceStatus,
  Master,
  Part,
  Reminder,
  ReminderStatus,
  TimelineEvent,
  Trip,
} from '../types'
import { buildDefaultItems } from '../data/defaultMaintenance'
import * as db from '../db/database'
import { composePartNote, composeServiceNote, type ParsedCarCsv } from '../utils/carCsvFormat'

const ACTIVE_CAR_KEY = 'my-car-active-car-id'

const cars = reactive<Car[]>([])
const activeCarId = ref<string | null>(null)
const items = reactive<MaintenanceItem[]>([])
const fuelEntries = reactive<FuelEntry[]>([])
const historyEntries = reactive<HistoryEntry[]>([])
const reminders = reactive<Reminder[]>([])
const masters = reactive<Master[]>([])
const expenses = reactive<Expense[]>([])
const componentChecks = reactive<ComponentCheck[]>([])
const trips = reactive<Trip[]>([])
const documents = reactive<CarDocument[]>([])
const isLoaded = ref(false)
/** True while importData/restoreFromCloud is replacing the whole database — lets useCloudSync suppress auto-sync so it can't export a partially-imported state over the cloud backup. */
const isImporting = ref(false)

const car = computed(() => cars.find((c) => c.id === activeCarId.value) ?? null)

function nowTs(): number {
  return Date.now()
}

function makeId(): string {
  return `id-${nowTs()}-${Math.random().toString(36).slice(2, 8)}`
}

function patchCar(carId: string, patch: Partial<Car>): Car | null {
  const idx = cars.findIndex((c) => c.id === carId)
  if (idx === -1) return null
  const updated: Car = { ...cars[idx], ...patch, updatedAt: patch.updatedAt ?? nowTs() }
  cars[idx] = updated
  return updated
}

// Guards against out-of-order resolution when loadCarData is kicked off more
// than once in quick succession (rapid car switches, or a switch racing a
// direct state replacement like createCar/deleteCar/importData): only the
// call that's still the most recently requested one is allowed to apply its
// results, so a slow, stale fetch can never clobber a newer state with the
// wrong car's data.
let loadCarDataToken = 0

async function loadCarData(carId: string): Promise<void> {
  const token = ++loadCarDataToken
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
  if (token !== loadCarDataToken) return
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
async function migrateLegacyDocuments(): Promise<void> {
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

async function load(): Promise<void> {
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

async function switchCar(carId: string): Promise<void> {
  if (carId === activeCarId.value) return
  if (!cars.some((c) => c.id === carId)) return
  activeCarId.value = carId
  localStorage.setItem(ACTIVE_CAR_KEY, carId)
  await loadCarData(carId)
}

async function createCar(input: {
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
  loadCarDataToken++

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

async function deleteCar(carId: string): Promise<void> {
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
    loadCarDataToken++
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

async function updateCarInfo(
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
async function updateMileage(
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

async function updateItem(
  id: string,
  patch: Partial<
    Pick<
      MaintenanceItem,
      | 'name'
      | 'intervalKm'
      | 'intervalKmMax'
      | 'intervalMonths'
      | 'lastServiceMileage'
      | 'note'
      | 'parts'
      | 'notifyBeforeKm'
      | 'notifyBeforeDays'
    >
  >,
): Promise<void> {
  const item = items.find((i) => i.id === id)
  if (!item) return
  Object.assign(item, patch)
  await db.putMaintenanceItem({ ...item })
}

export interface MarkServicedResult {
  historyEntryId: string
  previous: { lastServiceMileage: number; lastServiceDate: number | null }
}

async function markServiced(
  id: string,
  atMileage?: number,
  cost?: number,
  receiptPhoto?: string,
  date?: number,
  breakdown?: ExpenseItem[],
  masterId?: string,
): Promise<MarkServicedResult | null> {
  const item = items.find((i) => i.id === id)
  if (!item || !car.value) return null
  const previous = { lastServiceMileage: item.lastServiceMileage, lastServiceDate: item.lastServiceDate }
  const mileage = atMileage ?? car.value.currentMileage
  const serviceDate = date ?? nowTs()

  const entry: HistoryEntry = {
    id: makeId(),
    carId: car.value.id,
    itemId: item.id,
    itemName: item.name,
    mileage,
    date: serviceDate,
    cost,
    receiptPhoto,
    items: breakdown?.length ? breakdown : undefined,
    masterId: masterId || undefined,
  }

  item.lastServiceMileage = mileage
  item.lastServiceDate = serviceDate
  historyEntries.unshift(entry)

  try {
    await db.putMaintenanceItem({ ...item })
    await db.putHistoryEntry(entry)
  } catch (e) {
    // Roll back the optimistic in-memory changes so a failed write can't
    // leave the item looking "serviced" with no matching history record.
    item.lastServiceMileage = previous.lastServiceMileage
    item.lastServiceDate = previous.lastServiceDate
    const idx = historyEntries.findIndex((h) => h.id === entry.id)
    if (idx !== -1) historyEntries.splice(idx, 1)
    throw e
  }

  return { historyEntryId: entry.id, previous }
}

async function undoMarkServiced(id: string, result: MarkServicedResult): Promise<void> {
  const item = items.find((i) => i.id === id)
  if (item) {
    item.lastServiceMileage = result.previous.lastServiceMileage
    item.lastServiceDate = result.previous.lastServiceDate
    await db.putMaintenanceItem({ ...item })
  }
  const idx = historyEntries.findIndex((h) => h.id === result.historyEntryId)
  if (idx !== -1) historyEntries.splice(idx, 1)
  await db.deleteHistoryEntry(result.historyEntryId)
}

async function addCustomItem(input: {
  name: string
  intervalKm: number
  intervalKmMax?: number
  intervalMonths?: number
  parts?: Part[]
  notifyBeforeKm?: number
  notifyBeforeDays?: number
}): Promise<void> {
  if (!car.value) return
  const item: MaintenanceItem = {
    id: makeId(),
    carId: car.value.id,
    name: input.name.trim(),
    intervalKm: input.intervalKm,
    intervalKmMax: input.intervalKmMax,
    intervalMonths: input.intervalMonths,
    lastServiceMileage: car.value.currentMileage,
    lastServiceDate: nowTs(),
    isCustom: true,
    order: items.length,
    parts: input.parts ?? [],
    notifyBeforeKm: input.notifyBeforeKm,
    notifyBeforeDays: input.notifyBeforeDays,
  }
  items.push(item)
  await db.putMaintenanceItem(item)
}

async function deleteItem(id: string): Promise<MaintenanceItem | null> {
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) return null
  const [removed] = items.splice(index, 1)
  await db.deleteMaintenanceItem(id)
  return removed
}

async function restoreItem(item: MaintenanceItem): Promise<void> {
  if (items.some((i) => i.id === item.id)) return
  items.push(item)
  await db.putMaintenanceItem(item)
}

async function addFuelEntry(input: {
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

async function deleteFuelEntry(id: string): Promise<FuelEntry | null> {
  const index = fuelEntries.findIndex((e) => e.id === id)
  if (index === -1) return null
  const [removed] = fuelEntries.splice(index, 1)
  await db.deleteFuelEntry(id)
  return removed
}

async function restoreFuelEntry(entry: FuelEntry): Promise<void> {
  if (fuelEntries.some((e) => e.id === entry.id)) return
  fuelEntries.push(entry)
  await db.putFuelEntry(entry)
}

async function updateFuelEntry(
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

async function updateHistoryEntry(
  id: string,
  input: { itemName: string; mileage: number; date: number; cost?: number; receiptPhoto?: string; note?: string; items?: ExpenseItem[]; masterId?: string },
): Promise<void> {
  const entry = historyEntries.find((h) => h.id === id)
  if (!entry) return
  entry.itemName = input.itemName
  entry.mileage = input.mileage
  entry.date = input.date
  entry.cost = input.cost ?? undefined
  entry.receiptPhoto = input.receiptPhoto
  entry.note = input.note?.trim() || undefined
  entry.items = input.items?.length ? input.items : undefined
  entry.masterId = input.masterId || undefined
  await db.putHistoryEntry({ ...entry })
}

function getItemHistory(itemId: string): HistoryEntry[] {
  return historyEntries
    .filter((h) => h.itemId === itemId)
    .slice()
    .sort((a, b) => b.date - a.date)
}

async function addReminder(input: { text: string; dueMileage?: number; dueDate?: number; hasTime?: boolean }): Promise<void> {
  if (!car.value) return
  const reminder: Reminder = {
    id: makeId(),
    carId: car.value.id,
    text: input.text.trim(),
    createdAt: nowTs(),
    dueMileage: input.dueMileage,
    dueDate: input.dueDate,
    hasTime: input.hasTime,
  }
  reminders.push(reminder)
  await db.putReminder(reminder)
}

async function deleteReminder(id: string): Promise<Reminder | null> {
  const index = reminders.findIndex((r) => r.id === id)
  if (index === -1) return null
  const [removed] = reminders.splice(index, 1)
  await db.deleteReminder(id)
  return removed
}

async function restoreReminder(reminder: Reminder): Promise<void> {
  if (reminders.some((r) => r.id === reminder.id)) return
  reminders.push(reminder)
  await db.putReminder(reminder)
}

async function addMaster(input: {
  name: string
  phone?: string
  cardNumber?: string
  link?: string
  specialty?: string
}): Promise<void> {
  if (!car.value) return
  const master: Master = {
    id: makeId(),
    carId: car.value.id,
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    cardNumber: input.cardNumber?.trim() || undefined,
    link: input.link?.trim() || undefined,
    specialty: input.specialty?.trim() || undefined,
    createdAt: nowTs(),
  }
  masters.push(master)
  await db.putMaster(master)
}

async function updateMaster(
  id: string,
  patch: { name: string; phone?: string; cardNumber?: string; link?: string; specialty?: string },
): Promise<void> {
  const master = masters.find((m) => m.id === id)
  if (!master) return
  master.name = patch.name.trim()
  master.phone = patch.phone?.trim() || undefined
  master.cardNumber = patch.cardNumber?.trim() || undefined
  master.link = patch.link?.trim() || undefined
  master.specialty = patch.specialty?.trim() || undefined
  await db.putMaster({ ...master })
}

async function deleteMaster(id: string): Promise<Master | null> {
  const index = masters.findIndex((m) => m.id === id)
  if (index === -1) return null
  const [removed] = masters.splice(index, 1)
  await db.deleteMaster(id)
  return removed
}

async function restoreMaster(master: Master): Promise<void> {
  if (masters.some((m) => m.id === master.id)) return
  masters.push(master)
  await db.putMaster(master)
}

function recurrenceFor(payload: Pick<ExpensePayload, 'repeat' | 'date'>): Expense['recurrence'] {
  return payload.repeat ? { every: payload.repeat, anchorDay: new Date(payload.date).getDate() } : undefined
}

async function addExpense(input: Omit<ExpensePayload, 'date'> & { date?: number }): Promise<void> {
  if (!car.value) return
  const date = input.date ?? nowTs()
  const expense: Expense = {
    id: makeId(),
    carId: car.value.id,
    category: input.category,
    title: input.title?.trim() || undefined,
    amount: input.amount,
    date,
    note: input.note?.trim() || undefined,
    receiptPhoto: input.receiptPhoto,
    items: input.items?.length ? input.items : undefined,
    photos: input.photos?.length ? input.photos : undefined,
    masterId: input.masterId || undefined,
    itemId: input.itemId || undefined,
    recurrence: recurrenceFor({ repeat: input.repeat, date }),
  }
  expenses.unshift(expense)
  await db.putExpense(expense)
  // A series started in the past (or just now) may already owe entries.
  await applyRecurringExpenses()
}

async function updateExpense(id: string, patch: ExpensePayload): Promise<void> {
  const expense = expenses.find((e) => e.id === id)
  if (!expense) return
  expense.category = patch.category
  expense.title = patch.title?.trim() || undefined
  expense.amount = patch.amount
  expense.date = patch.date
  expense.note = patch.note?.trim() || undefined
  expense.receiptPhoto = patch.receiptPhoto
  expense.items = patch.items?.length ? patch.items : undefined
  expense.photos = patch.photos?.length ? patch.photos : undefined
  expense.masterId = patch.masterId || undefined
  expense.itemId = patch.itemId || undefined
  expense.recurrence = recurrenceFor(patch)
  await db.putExpense({ ...expense })
  await applyRecurringExpenses()
}

// Serialises runs so a save and a car load can't both see the same head and
// each create the entries it owes.
let recurringQueue: Promise<unknown> = Promise.resolve()

/** Creates the entries that repeating expenses owe up to now (see utils/recurring.ts). */
function applyRecurringExpenses(): Promise<number> {
  const run = async (): Promise<number> => {
    const { updated, created } = materializeRecurring(expenses, nowTs(), makeId)
    if (created.length === 0) return 0
    for (const head of updated) {
      const live = expenses.find((e) => e.id === head.id)
      if (live) live.recurrence = undefined
      await db.putExpense({ ...head })
    }
    for (const e of created) {
      expenses.unshift(e)
      await db.putExpense(e)
    }
    return created.length
  }
  const next = recurringQueue.then(run, run)
  recurringQueue = next.catch(() => undefined)
  return next
}

async function deleteExpense(id: string): Promise<Expense | null> {
  const index = expenses.findIndex((e) => e.id === id)
  if (index === -1) return null
  const [removed] = expenses.splice(index, 1)
  await db.deleteExpense(id)
  return removed
}

async function restoreExpense(expense: Expense): Promise<void> {
  if (expenses.some((e) => e.id === expense.id)) return
  expenses.push(expense)
  await db.putExpense(expense)
}

async function addDocument(input: {
  type: DocumentType
  title?: string
  number?: string
  issuedDate?: number
  expiryDate?: number
  photos?: string[]
  note?: string
}): Promise<void> {
  if (!car.value) return
  const document: CarDocument = {
    id: makeId(),
    carId: car.value.id,
    type: input.type,
    title: input.title?.trim() || undefined,
    number: input.number?.trim() || undefined,
    issuedDate: input.issuedDate,
    expiryDate: input.expiryDate,
    photos: input.photos ?? [],
    note: input.note?.trim() || undefined,
    createdAt: nowTs(),
  }
  documents.push(document)
  await db.putDocument(document)
}

async function updateDocument(
  id: string,
  patch: {
    type: DocumentType
    title?: string
    number?: string
    issuedDate?: number
    expiryDate?: number
    photos: string[]
    note?: string
  },
): Promise<void> {
  const document = documents.find((d) => d.id === id)
  if (!document) return
  document.type = patch.type
  document.title = patch.title?.trim() || undefined
  document.number = patch.number?.trim() || undefined
  document.issuedDate = patch.issuedDate
  document.expiryDate = patch.expiryDate
  document.photos = patch.photos
  document.note = patch.note?.trim() || undefined
  await db.putDocument({ ...document, photos: [...document.photos] })
}

async function deleteDocument(id: string): Promise<CarDocument | null> {
  const index = documents.findIndex((d) => d.id === id)
  if (index === -1) return null
  const [removed] = documents.splice(index, 1)
  await db.deleteDocument(id)
  return removed
}

async function restoreDocument(document: CarDocument): Promise<void> {
  if (documents.some((d) => d.id === document.id)) return
  documents.push(document)
  await db.putDocument(document)
}

/** Due/soon status for every document that has an expiry date, most urgent first. */
const documentStatuses = computed<DocumentStatus[]>(() => buildDocumentStatuses(documents, Date.now()))

async function addComponentCheck(input: {
  type: ComponentType
  mileage?: number
  date?: number
  season?: 'summer' | 'winter' | 'allseason'
  treadDepthMm?: number
  pressureFront?: number
  pressureRear?: number
  thicknessMm?: number
  installedDate?: number
  note?: string
}): Promise<void> {
  if (!car.value) return
  const check: ComponentCheck = {
    id: makeId(),
    carId: car.value.id,
    type: input.type,
    mileage: input.mileage ?? car.value.currentMileage,
    date: input.date ?? nowTs(),
    season: input.season,
    treadDepthMm: input.treadDepthMm,
    pressureFront: input.pressureFront,
    pressureRear: input.pressureRear,
    thicknessMm: input.thicknessMm,
    installedDate: input.installedDate,
    note: input.note?.trim() || undefined,
  }
  componentChecks.unshift(check)
  await db.putComponentCheck(check)
}

async function deleteComponentCheck(id: string): Promise<ComponentCheck | null> {
  const index = componentChecks.findIndex((c) => c.id === id)
  if (index === -1) return null
  const [removed] = componentChecks.splice(index, 1)
  await db.deleteComponentCheck(id)
  return removed
}

async function restoreComponentCheck(check: ComponentCheck): Promise<void> {
  if (componentChecks.some((c) => c.id === check.id)) return
  componentChecks.push(check)
  await db.putComponentCheck(check)
}

/** Latest logged reading per component type, or null when none has ever been logged. */
const latestComponentByType = computed<Record<ComponentType, ComponentCheck | null>>(() => {
  const result: Record<ComponentType, ComponentCheck | null> = { tires: null, battery: null, brakePads: null }
  for (const type of Object.keys(result) as ComponentType[]) {
    const matching = componentChecks.filter((c) => c.type === type).sort((a, b) => b.date - a.date)
    result[type] = matching[0] ?? null
  }
  return result
})

async function addTrip(input: {
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

async function deleteTrip(id: string): Promise<Trip | null> {
  const index = trips.findIndex((t) => t.id === id)
  if (index === -1) return null
  const [removed] = trips.splice(index, 1)
  await db.deleteTrip(id)
  return removed
}

async function restoreTrip(trip: Trip): Promise<void> {
  if (trips.some((t) => t.id === trip.id)) return
  trips.push(trip)
  await db.putTrip(trip)
}

const totalBusinessKm = computed(() =>
  trips.filter((t) => t.purpose === 'business').reduce((sum, t) => sum + Math.max(0, t.endMileage - t.startMileage), 0),
)
const totalPersonalKm = computed(() =>
  trips.filter((t) => t.purpose === 'personal').reduce((sum, t) => sum + Math.max(0, t.endMileage - t.startMileage), 0),
)

const DAY_MS = 24 * 60 * 60 * 1000

const avgDailyKm = computed<number | null>(() => averageDailyKm(fuelEntries))

function statusFor(
  item: MaintenanceItem,
  currentMileage: number,
  now: number,
  dailyKm: number | null,
): MaintenanceStatus {
  const itemHistory = historyEntries.filter((h) => h.itemId === item.id)
  return maintenanceStatus(item, currentMileage, now, dailyKm, itemHistory)
}

const statuses = computed<MaintenanceStatus[]>(() => {
  if (!car.value) return []
  const now = Date.now()
  const dailyKm = avgDailyKm.value
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => statusFor(item, car.value!.currentMileage, now, dailyKm))
})

const dueCount = computed(
  () => statuses.value.filter((s) => s.state === 'due').length,
)
const soonCount = computed(
  () => statuses.value.filter((s) => s.state === 'soon').length,
)
const okCount = computed(
  () => statuses.value.filter((s) => s.state === 'ok').length,
)

/** Due-first, then oldest-added-first (km-based and date-based reminders aren't directly comparable, so no finer sort). */
const reminderStatuses = computed<ReminderStatus[]>(() => {
  if (!car.value) return []
  const now = Date.now()
  const mileage = car.value.currentMileage
  return reminders
    .map((reminder) => {
      const remainingKm = reminder.dueMileage !== undefined ? reminder.dueMileage - mileage : undefined
      const remainingDays =
        reminder.dueDate !== undefined ? Math.ceil((reminder.dueDate - now) / DAY_MS) : undefined
      const isDue = (remainingKm !== undefined && remainingKm <= 0) || (remainingDays !== undefined && remainingDays <= 0)
      return { reminder, isDue, remainingKm, remainingDays }
    })
    .sort((a, b) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1
      return a.reminder.createdAt - b.reminder.createdAt
    })
})

// (fuel analytics live in utils/fuelAnalytics.ts)

const consumptionAnalysis = computed<ConsumptionAnalysis>(() => {
  if (!car.value) return { history: [], average: null, currentLevelLiters: null }
  return analyzeConsumption(fuelEntries, car.value)
})

const averageConsumption = computed<number | null>(() => consumptionAnalysis.value.average)
const fuelHistory = computed<FuelConsumption[]>(() => consumptionAnalysis.value.history)

const estimatedRangeKm = computed<number | null>(() =>
  estimatedRange(consumptionAnalysis.value.currentLevelLiters, averageConsumption.value),
)

const averageFuelPriceValue = computed<number | null>(() => averageFuelPrice(fuelEntries))

const totalCo2KgValue = computed<number>(() => totalCo2Kg(fuelEntries))

const fuelInsights = computed<FuelInsight[]>(() => {
  if (!car.value) return []
  return buildFuelInsights({
    car: car.value,
    fuelEntries,
    history: fuelHistory.value,
    averageConsumption: averageConsumption.value,
    rangeKm: estimatedRangeKm.value,
    dailyKm: avgDailyKm.value,
    currency: currency.value,
    now: Date.now(),
  })
})

const monthDistanceKm = computed<number | null>(() => {
  if (!car.value) return null
  return monthDistance(car.value, fuelEntries, historyEntries, Date.now())
})

/** Fuel fill-ups, completed maintenance and other expenses, merged into one date-sorted feed. */
const timelineEvents = computed<TimelineEvent[]>(() => {
  const fuel: TimelineEvent[] = fuelEntries.map((e) => ({
    kind: 'fuel',
    id: e.id,
    date: e.date,
    mileage: e.mileage,
    entry: e,
  }))
  const service: TimelineEvent[] = historyEntries.map((h) => ({
    kind: 'service',
    id: h.id,
    date: h.date,
    mileage: h.mileage,
    entry: h,
  }))
  const other: TimelineEvent[] = expenses.map((e) => ({
    kind: 'expense',
    id: e.id,
    date: e.date,
    mileage: null,
    entry: e,
  }))
  return [...fuel, ...service, ...other].sort((a, b) => b.date - a.date)
})

const totalFuelCost = computed(() =>
  fuelEntries.reduce((sum, e) => sum + (e.cost ?? 0), 0),
)
const totalServiceCost = computed(() =>
  historyEntries.reduce((sum, h) => sum + (h.cost ?? 0), 0),
)
const totalExpensesCost = computed(() => expenses.reduce((sum, e) => sum + e.amount, 0))
const totalCost = computed(() => totalFuelCost.value + totalServiceCost.value + totalExpensesCost.value)
const hasAnyCost = computed(
  () =>
    fuelEntries.some((e) => e.cost !== undefined) ||
    historyEntries.some((h) => h.cost !== undefined) ||
    expenses.length > 0,
)

const costForecast = computed<{ sixMonths: CostForecast | null; twelveMonths: CostForecast | null }>(() => {
  if (!car.value) return { sixMonths: null, twelveMonths: null }
  return forecastCosts({ fuelEntries, historyEntries, items, dailyKm: avgDailyKm.value, now: Date.now() })
})


function isMultiCarBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return Array.isArray(d.cars) && Array.isArray(d.items)
}

function isLegacyBackup(data: unknown): data is LegacyBackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return typeof d.car === 'object' && d.car !== null && Array.isArray(d.items)
}

async function exportData(): Promise<BackupData> {
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

async function importData(data: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  let importedCars: Car[]
  let importedItems: MaintenanceItem[]
  let importedFuel: FuelEntry[]
  let importedHistory: HistoryEntry[]
  let importedReminders: Reminder[]
  let importedMasters: Master[]
  let importedExpenses: Expense[]
  let importedComponents: ComponentCheck[]
  let importedTrips: Trip[]
  let importedDocuments: CarDocument[]
  let newActiveCarId: string | undefined

  // Applied only once the import succeeded, so a rejected file can't change settings.
  const importedBudget = isMultiCarBackup(data) ? data.settings?.monthlyBudget : undefined

  if (isMultiCarBackup(data)) {
    importedCars = data.cars
    importedItems = data.items.map((i) => ({ ...i, parts: i.parts ?? [] }))
    importedFuel = Array.isArray(data.fuelEntries) ? data.fuelEntries : []
    importedHistory = Array.isArray(data.historyEntries) ? data.historyEntries : []
    importedReminders = Array.isArray(data.reminders) ? data.reminders : []
    importedMasters = Array.isArray(data.masters) ? data.masters : []
    importedExpenses = Array.isArray(data.expenses) ? data.expenses : []
    importedComponents = Array.isArray(data.components) ? data.components : []
    importedTrips = Array.isArray(data.trips) ? data.trips : []
    importedDocuments = Array.isArray(data.documents) ? data.documents : []
    newActiveCarId =
      data.activeCarId && importedCars.some((c) => c.id === data.activeCarId)
        ? data.activeCarId
        : importedCars[0]?.id
  } else if (isLegacyBackup(data)) {
    const carId = data.car.id && data.car.id !== 'main' ? data.car.id : makeId()
    importedCars = [{ ...data.car, id: carId }]
    importedItems = data.items.map((i) => ({ ...i, carId, parts: i.parts ?? [] }))
    importedFuel = (data.fuelEntries ?? []).map((f) => ({ ...f, carId }))
    importedHistory = (data.historyEntries ?? []).map((h) => ({ ...h, carId }))
    importedReminders = []
    importedMasters = []
    importedExpenses = []
    importedComponents = []
    importedTrips = []
    importedDocuments = []
    newActiveCarId = carId
  } else {
    return { ok: false, error: 'Файл повреждён или это не резервная копия «Моей машины»' }
  }

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
    loadCarDataToken++

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
  return { ok: true }
}

export interface CsvImportSummary {
  fuelAdded: number
  fuelSkipped: number
  serviceAdded: number
  serviceSkipped: number
  partsAdded: number
  partsSkippedNoDate: number
}

/**
 * Additive import from the «Моя машина» (third-party app) CSV export: fuel
 * fill-ups are added as-is, while service/parts rows are matched to an
 * existing MaintenanceItem by name (or a new default one is created) so each
 * row can become a HistoryEntry the same way a normal "mark serviced" does.
 * Rows already present (same item + date + mileage, or same date + mileage
 * for fuel) are skipped so re-importing the same file is a no-op.
 */
async function importCarCsv(parsed: ParsedCarCsv): Promise<CsvImportSummary> {
  const summary: CsvImportSummary = {
    fuelAdded: 0,
    fuelSkipped: 0,
    serviceAdded: 0,
    serviceSkipped: 0,
    partsAdded: 0,
    partsSkippedNoDate: parsed.skippedPartsCount,
  }
  if (!car.value) return summary

  const fuelSorted = parsed.fuel.slice().sort((a, b) => a.mileage - b.mileage)
  for (const row of fuelSorted) {
    if (fuelEntries.some((e) => e.date === row.date && e.mileage === row.mileage)) {
      summary.fuelSkipped++
      continue
    }
    await addFuelEntry({
      mileage: row.mileage,
      liters: row.liters,
      date: row.date,
      cost: row.cost,
      fuelType: row.fuelType,
      isFullTank: row.isFullTank,
      station: row.station,
      comment: row.comment,
    })
    summary.fuelAdded++
  }

  async function importServiceEvent(
    name: string,
    date: number,
    mileage: number,
    cost: number | undefined,
    note: string | undefined,
  ): Promise<boolean> {
    const normalized = name.trim().toLowerCase()
    let item = items.find((i) => i.name.trim().toLowerCase() === normalized)
    if (!item) {
      await addCustomItem({ name, intervalKm: 10000, intervalMonths: 12 })
      item = items.find((i) => i.name.trim().toLowerCase() === normalized)
    }
    if (!item || !car.value) return false
    const carId = car.value.id

    if (historyEntries.some((h) => h.itemId === item!.id && h.date === date && h.mileage === mileage)) return false

    const entry: HistoryEntry = {
      id: makeId(),
      carId,
      itemId: item.id,
      itemName: item.name,
      mileage,
      date,
      cost,
      note,
    }
    historyEntries.push(entry)
    await db.putHistoryEntry(entry)

    if (mileage >= item.lastServiceMileage) {
      item.lastServiceMileage = mileage
      item.lastServiceDate = date
      await db.putMaintenanceItem({ ...item })
    }
    if (car.value?.id === carId && mileage > car.value.currentMileage) {
      await updateMileage(mileage, date)
    }
    return true
  }

  const serviceSorted = parsed.service.slice().sort((a, b) => a.mileage - b.mileage)
  for (const row of serviceSorted) {
    const added = await importServiceEvent(row.name, row.date, row.mileage, row.cost, composeServiceNote(row))
    if (added) summary.serviceAdded++
    else summary.serviceSkipped++
  }

  const partsSorted = parsed.parts.slice().sort((a, b) => a.mileage - b.mileage)
  for (const row of partsSorted) {
    const added = await importServiceEvent(row.name, row.date, row.mileage, row.cost, composePartNote(row))
    if (added) summary.partsAdded++
  }

  return summary
}

export function useCarStore() {
  return {
    cars,
    car,
    items,
    fuelEntries,
    historyEntries,
    reminders,
    masters,
    expenses,
    componentChecks,
    trips,
    isLoaded,
    isImporting,
    statuses,
    dueCount,
    soonCount,
    okCount,
    reminderStatuses,
    documents,
    documentStatuses,
    latestComponentByType,
    totalBusinessKm,
    totalPersonalKm,
    fuelHistory,
    averageConsumption,
    monthDistanceKm,
    timelineEvents,
    estimatedRangeKm,
    averageFuelPrice: averageFuelPriceValue,
    totalCo2Kg: totalCo2KgValue,
    fuelInsights,
    totalFuelCost,
    totalServiceCost,
    totalExpensesCost,
    totalCost,
    hasAnyCost,
    costForecast,
    load,
    switchCar,
    createCar,
    deleteCar,
    updateCarInfo,
    updateMileage,
    updateItem,
    markServiced,
    undoMarkServiced,
    addCustomItem,
    deleteItem,
    restoreItem,
    addReminder,
    deleteReminder,
    restoreReminder,
    addMaster,
    updateMaster,
    deleteMaster,
    restoreMaster,
    addExpense,
    updateExpense,
    deleteExpense,
    restoreExpense,
    addDocument,
    updateDocument,
    deleteDocument,
    restoreDocument,
    addComponentCheck,
    deleteComponentCheck,
    restoreComponentCheck,
    addTrip,
    deleteTrip,
    restoreTrip,
    addFuelEntry,
    deleteFuelEntry,
    restoreFuelEntry,
    updateFuelEntry,
    updateHistoryEntry,
    getItemHistory,
    exportData,
    importData,
    importCarCsv,
  }
}
