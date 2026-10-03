import { EXPENSE_CATEGORY_LABELS, EXPENSE_ITEM_KIND_LABELS, DOCUMENT_TYPE_LABELS } from '../../types'
import type {
  Car,
  CarDocument,
  ComponentCheck,
  Expense,
  ExpenseItem,
  FuelEntry,
  HistoryEntry,
  MaintenanceItem,
  Master,
  Reminder,
  Trip,
} from '../../types'

/**
 * Checks and cleans the records of a backup before they replace the user's data.
 * A backup is a file anyone can edit or damage, so nothing in it is trusted: a record is
 * kept only if its identifying fields and numbers are valid; broken ones are dropped and
 * counted rather than allowed to crash the app later (a NaN mileage, a missing id...).
 * Unknown extra fields are left alone so newer backups keep their data.
 */
export interface BackupRecords {
  cars: unknown[]
  items: unknown[]
  fuel: unknown[]
  history: unknown[]
  reminders: unknown[]
  masters: unknown[]
  expenses: unknown[]
  components: unknown[]
  trips: unknown[]
  documents: unknown[]
}

export interface CleanBackup {
  cars: Car[]
  items: MaintenanceItem[]
  fuel: FuelEntry[]
  history: HistoryEntry[]
  reminders: Reminder[]
  masters: Master[]
  expenses: Expense[]
  components: ComponentCheck[]
  trips: Trip[]
  documents: CarDocument[]
  /** Records dropped because they were damaged, duplicated or belonged to no car. */
  skipped: number
}

type Rec = Record<string, unknown>

const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
/** Timestamps in a plausible range (1970..year 2200), which rejects stray 0s and overflowed values. */
const isTime = (v: unknown): v is number => isNum(v) && v > 0 && v < 7_258_118_400_000
const isKm = (v: unknown): v is number => isNum(v) && v >= 0 && v < 100_000_000

function dropBadOptional(r: Rec, keys: string[], ok: (v: unknown) => boolean): void {
  for (const k of keys) if (k in r && r[k] !== undefined && !ok(r[k])) delete r[k]
}

function cleanItems(raw: unknown): ExpenseItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const kinds = Object.keys(EXPENSE_ITEM_KIND_LABELS)
  const out = raw.filter(
    (i): i is ExpenseItem => isObj(i) && isStr(i.id) && isStr(i.name) && kinds.includes(i.kind as string) && isNum(i.amount) && i.amount >= 0,
  )
  return out.length > 0 ? out : undefined
}

function cleanStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter(isStr) : []
}

type Cleaner<T> = (r: Rec, ctx: { index: number; now: number }) => T | null

const cleanCar: Cleaner<Car> = (r, { now }) => {
  if (!isStr(r.id) || !r.id || !isStr(r.make) || !isStr(r.model) || !isNum(r.year) || !isKm(r.initialMileage) || !isKm(r.currentMileage)) return null
  if (!isTime(r.createdAt)) r.createdAt = now
  if (!isTime(r.updatedAt)) r.updatedAt = r.createdAt
  dropBadOptional(r, ['tankCapacity', 'referenceConsumptionL100km'], (v) => isNum(v) && v > 0)
  dropBadOptional(r, ['vin', 'licensePlate', 'stsNumber'], isStr)
  if ('photos' in r) r.photos = cleanStrings(r.photos)
  return r as unknown as Car
}

const cleanItem: Cleaner<MaintenanceItem> = (r, { index }) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !isStr(r.name) || !isNum(r.intervalKm) || r.intervalKm < 0 || !isKm(r.lastServiceMileage)) return null
  r.lastServiceDate = isTime(r.lastServiceDate) ? r.lastServiceDate : null
  if (typeof r.isCustom !== 'boolean') r.isCustom = false
  if (!isNum(r.order)) r.order = index
  r.parts = Array.isArray(r.parts) ? r.parts.filter((p) => isObj(p) && isStr(p.id) && isStr(p.name)) : []
  dropBadOptional(r, ['intervalKmMax', 'intervalMonths', 'notifyBeforeKm', 'notifyBeforeDays'], (v) => isNum(v) && v >= 0)
  dropBadOptional(r, ['note'], isStr)
  return r as unknown as MaintenanceItem
}

const cleanFuel: Cleaner<FuelEntry> = (r) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !isKm(r.mileage) || !isNum(r.liters) || r.liters < 0 || !isTime(r.date)) return null
  dropBadOptional(r, ['cost', 'remainingLiters'], (v) => isNum(v) && v >= 0)
  dropBadOptional(r, ['fuelType', 'station', 'comment', 'receiptPhoto'], isStr)
  dropBadOptional(r, ['isFullTank'], (v) => typeof v === 'boolean')
  return r as unknown as FuelEntry
}

const cleanHistory: Cleaner<HistoryEntry> = (r) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !isStr(r.itemId) || !isStr(r.itemName) || !isKm(r.mileage) || !isTime(r.date)) return null
  dropBadOptional(r, ['cost'], (v) => isNum(v) && v >= 0)
  dropBadOptional(r, ['note', 'receiptPhoto', 'masterId'], isStr)
  const items = cleanItems(r.items)
  if (items) r.items = items
  else delete r.items
  return r as unknown as HistoryEntry
}

const cleanReminder: Cleaner<Reminder> = (r, { now }) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !isStr(r.text)) return null
  if (!isTime(r.createdAt)) r.createdAt = now
  dropBadOptional(r, ['dueMileage'], isKm)
  dropBadOptional(r, ['dueDate'], isTime)
  if (r.dueMileage === undefined && r.dueDate === undefined) return null // nothing it could ever fire on
  return r as unknown as Reminder
}

const cleanMaster: Cleaner<Master> = (r, { now }) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !isStr(r.name)) return null
  if (!isTime(r.createdAt)) r.createdAt = now
  dropBadOptional(r, ['phone', 'cardNumber', 'link', 'specialty'], isStr)
  return r as unknown as Master
}

const cleanExpense: Cleaner<Expense> = (r) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !isNum(r.amount) || r.amount < 0 || !isTime(r.date)) return null
  if (!isStr(r.category) || !(r.category in EXPENSE_CATEGORY_LABELS)) r.category = 'other'
  dropBadOptional(r, ['title', 'note', 'receiptPhoto', 'masterId', 'itemId'], isStr)
  dropBadOptional(r, ['renewalDate'], isTime)
  const items = cleanItems(r.items)
  if (items) r.items = items
  else delete r.items
  if ('photos' in r) {
    const photos = cleanStrings(r.photos)
    if (photos.length > 0) r.photos = photos
    else delete r.photos
  }
  if ('recurrence' in r) {
    const rec = r.recurrence
    const valid = isObj(rec) && (rec.every === 'month' || rec.every === 'year') && isNum(rec.anchorDay) && rec.anchorDay >= 1 && rec.anchorDay <= 31
    if (!valid) delete r.recurrence
  }
  return r as unknown as Expense
}

const cleanComponent: Cleaner<ComponentCheck> = (r) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !['tires', 'battery', 'brakePads'].includes(r.type as string) || !isKm(r.mileage) || !isTime(r.date)) return null
  dropBadOptional(r, ['treadDepthMm', 'pressureFront', 'pressureRear', 'thicknessMm'], (v) => isNum(v) && v >= 0)
  return r as unknown as ComponentCheck
}

const cleanTrip: Cleaner<Trip> = (r) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId) || !isTime(r.date) || !isKm(r.startMileage) || !isKm(r.endMileage)) return null
  if (r.purpose !== 'business' && r.purpose !== 'personal') r.purpose = 'personal'
  dropBadOptional(r, ['note'], isStr)
  return r as unknown as Trip
}

const cleanDocument: Cleaner<CarDocument> = (r, { now }) => {
  if (!isStr(r.id) || !r.id || !isStr(r.carId)) return null
  if (!isStr(r.type) || !(r.type in DOCUMENT_TYPE_LABELS)) r.type = 'other'
  r.photos = cleanStrings(r.photos)
  if (!isTime(r.createdAt)) r.createdAt = now
  dropBadOptional(r, ['issuedDate', 'expiryDate'], isTime)
  dropBadOptional(r, ['title', 'number', 'note'], isStr)
  return r as unknown as CarDocument
}

/** Cleans one list: keeps valid records, the last one for a repeated id, and optionally only those of known cars. */
function cleanList<T extends { id: string; carId?: string }>(
  raw: unknown[],
  clean: Cleaner<T>,
  now: number,
  carIds: Set<string> | null,
  counter: { skipped: number },
): T[] {
  const byId = new Map<string, T>()
  raw.forEach((entry, index) => {
    if (!isObj(entry)) {
      counter.skipped++
      return
    }
    // Work on a copy: the caller's object is never mutated.
    const out = clean({ ...entry }, { index, now })
    if (!out || (carIds && !carIds.has((out as { carId?: string }).carId ?? ''))) {
      counter.skipped++
      return
    }
    if (byId.has(out.id)) counter.skipped++
    byId.set(out.id, out)
  })
  return [...byId.values()]
}

export function cleanBackupRecords(input: BackupRecords, now = Date.now()): CleanBackup {
  const counter = { skipped: 0 }
  const cars = cleanList<Car & { carId?: string }>(input.cars, cleanCar as Cleaner<Car & { carId?: string }>, now, null, counter)
  const carIds = new Set(cars.map((c) => c.id))
  return {
    cars,
    items: cleanList(input.items, cleanItem, now, carIds, counter),
    fuel: cleanList(input.fuel, cleanFuel, now, carIds, counter),
    history: cleanList(input.history, cleanHistory, now, carIds, counter),
    reminders: cleanList(input.reminders, cleanReminder, now, carIds, counter),
    masters: cleanList(input.masters, cleanMaster, now, carIds, counter),
    expenses: cleanList(input.expenses, cleanExpense, now, carIds, counter),
    components: cleanList(input.components, cleanComponent, now, carIds, counter),
    trips: cleanList(input.trips, cleanTrip, now, carIds, counter),
    documents: cleanList(input.documents, cleanDocument, now, carIds, counter),
    skipped: counter.skipped,
  }
}

/** The newest backup format this build understands. */
export const SUPPORTED_BACKUP_VERSION = 2
