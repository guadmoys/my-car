import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { isSealed, isVaultEnabled, openJson, sealJson } from '../utils/security/vault'
import type { Car, CarDocument, ComponentCheck, Expense, FuelEntry, HistoryEntry, MaintenanceItem, Master, Reminder, Trip } from '../types'

interface MyCarDB extends DBSchema {
  cars: {
    key: string
    value: Car
  }
  maintenanceItems: {
    key: string
    value: MaintenanceItem
    indexes: { 'by-order': number; 'by-car': string }
  }
  fuelEntries: {
    key: string
    value: FuelEntry
    indexes: { 'by-mileage': number; 'by-car': string }
  }
  history: {
    key: string
    value: HistoryEntry
    indexes: { 'by-date': number; 'by-car': string }
  }
  reminders: {
    key: string
    value: Reminder
    indexes: { 'by-car': string }
  }
  masters: {
    key: string
    value: Master
    indexes: { 'by-car': string }
  }
  expenses: {
    key: string
    value: Expense
    indexes: { 'by-car': string }
  }
  components: {
    key: string
    value: ComponentCheck
    indexes: { 'by-car': string }
  }
  trips: {
    key: string
    value: Trip
    indexes: { 'by-car': string }
  }
  documents: {
    key: string
    value: CarDocument
    indexes: { 'by-car': string }
  }
}

const DB_NAME = 'my-car-db'
const DB_VERSION = 8

/**
 * IndexedDB's structured clone can choke on Vue reactive proxies (nested
 * arrays/objects in particular), so strip reactivity before writing.
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

type StoreName =
  | 'cars'
  | 'maintenanceItems'
  | 'fuelEntries'
  | 'history'
  | 'reminders'
  | 'masters'
  | 'expenses'
  | 'components'
  | 'trips'
  | 'documents'

const ALL_STORES: StoreName[] = [
  'cars',
  'maintenanceItems',
  'fuelEntries',
  'history',
  'reminders',
  'masters',
  'expenses',
  'components',
  'trips',
  'documents',
]

interface Row {
  id: string
  carId?: string
}

/**
 * With encryption on, a record is stored as `{ id, carId?, e, iv, ct }`: the
 * whole record AES-GCM encrypted, bound to `store:id`, with only the two keys
 * IndexedDB needs for lookup (`id`, and `carId` for the by-car index) left in
 * the clear. The other indexes (order, mileage, date) are never queried, so
 * sealed records simply drop out of them. Plain records pass through, which
 * keeps a half-finished migration readable.
 */
async function seal<T extends Row>(store: StoreName, record: T): Promise<unknown> {
  const plain = toPlain(record)
  if (!isVaultEnabled()) return plain
  const sealed: Record<string, unknown> = { id: plain.id, ...(await sealJson(plain, `${store}:${plain.id}`)) }
  if (plain.carId !== undefined) sealed.carId = plain.carId
  return sealed
}

async function open<T>(store: StoreName, raw: unknown): Promise<T> {
  if (isSealed(raw)) return openJson<T>(raw, `${store}:${(raw as unknown as Row).id}`)
  return raw as T
}

async function openAll<T>(store: StoreName, rows: unknown[]): Promise<T[]> {
  return Promise.all(rows.map((r) => open<T>(store, r)))
}

async function sealAll<T extends Row>(store: StoreName, records: T[]): Promise<unknown[]> {
  return Promise.all(records.map((r) => seal(store, r)))
}

let dbPromise: Promise<IDBPDatabase<MyCarDB>> | null = null

function getDB(): Promise<IDBPDatabase<MyCarDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MyCarDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('maintenanceItems')) {
          const store = db.createObjectStore('maintenanceItems', { keyPath: 'id' })
          store.createIndex('by-order', 'order')
        }
        if (!db.objectStoreNames.contains('fuelEntries')) {
          const store = db.createObjectStore('fuelEntries', { keyPath: 'id' })
          store.createIndex('by-mileage', 'mileage')
        }
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', { keyPath: 'id' })
          store.createIndex('by-date', 'date')
        }
        if (!db.objectStoreNames.contains('reminders')) {
          const store = db.createObjectStore('reminders', { keyPath: 'id' })
          store.createIndex('by-car', 'carId')
        }
        if (!db.objectStoreNames.contains('masters')) {
          const store = db.createObjectStore('masters', { keyPath: 'id' })
          store.createIndex('by-car', 'carId')
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const store = db.createObjectStore('expenses', { keyPath: 'id' })
          store.createIndex('by-car', 'carId')
        }
        if (!db.objectStoreNames.contains('components')) {
          const store = db.createObjectStore('components', { keyPath: 'id' })
          store.createIndex('by-car', 'carId')
        }
        if (!db.objectStoreNames.contains('trips')) {
          const store = db.createObjectStore('trips', { keyPath: 'id' })
          store.createIndex('by-car', 'carId')
        }
        if (!db.objectStoreNames.contains('documents')) {
          const store = db.createObjectStore('documents', { keyPath: 'id' })
          store.createIndex('by-car', 'carId')
        }

        if (oldVersion < 4) {
          const carsStore = db.objectStoreNames.contains('cars')
            ? transaction.objectStore('cars')
            : db.createObjectStore('cars', { keyPath: 'id' })

          const itemsStore = transaction.objectStore('maintenanceItems')
          if (!itemsStore.indexNames.contains('by-car')) itemsStore.createIndex('by-car', 'carId')

          const fuelStore = transaction.objectStore('fuelEntries')
          if (!fuelStore.indexNames.contains('by-car')) fuelStore.createIndex('by-car', 'carId')

          const historyStore = transaction.objectStore('history')
          if (!historyStore.indexNames.contains('by-car')) historyStore.createIndex('by-car', 'carId')

          // Migrate the old single-car layout (v1-v3): one 'car' store keyed
          // 'main', and items/fuel/history with no carId at all.
          // 'car' isn't part of the current schema anymore, hence the casts below.
          const looseDb = db as unknown as {
            objectStoreNames: { contains(name: string): boolean }
            deleteObjectStore(name: string): void
          }
          if (looseDb.objectStoreNames.contains('car')) {
            const legacyStore = (transaction as unknown as { objectStore(name: string): any }).objectStore(
              'car',
            )
            const legacyCar = await legacyStore.get('main')
            if (legacyCar) {
              const carId = `car-${Date.now()}`
              await carsStore.put({ ...legacyCar, id: carId })

              for (const storeName of ['maintenanceItems', 'fuelEntries', 'history'] as const) {
                const store = transaction.objectStore(storeName)
                let cursor = await store.openCursor()
                while (cursor) {
                  if (!cursor.value.carId) {
                    await cursor.update({ ...cursor.value, carId })
                  }
                  cursor = await cursor.continue()
                }
              }
            }
            looseDb.deleteObjectStore('car')
          }
        }
      },
    })
  }
  return dbPromise
}

export async function getAllCars(): Promise<Car[]> {
  const db = await getDB()
  return openAll<Car>('cars', await db.getAll('cars'))
}

export async function putCar(car: Car): Promise<void> {
  const db = await getDB()
  await db.put('cars', (await seal('cars', car)) as never)
}

export async function deleteCarCascade(carId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['cars', 'maintenanceItems', 'fuelEntries', 'history', 'reminders', 'masters', 'expenses', 'components', 'trips', 'documents'],
    'readwrite',
  )
  await tx.objectStore('cars').delete(carId)

  for (const storeName of [
    'maintenanceItems',
    'fuelEntries',
    'history',
    'reminders',
    'masters',
    'expenses',
    'components',
    'trips',
    'documents',
  ] as const) {
    const store = tx.objectStore(storeName)
    const index = store.index('by-car')
    let cursor = await index.openCursor(IDBKeyRange.only(carId))
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  }
  await tx.done
}

export async function getMaintenanceItemsForCar(carId: string): Promise<MaintenanceItem[]> {
  const db = await getDB()
  const items = await openAll<MaintenanceItem>('maintenanceItems', await db.getAllFromIndex('maintenanceItems', 'by-car', carId))
  return items.sort((a, b) => a.order - b.order)
}

export async function getAllMaintenanceItemsRaw(): Promise<MaintenanceItem[]> {
  const db = await getDB()
  return openAll<MaintenanceItem>('maintenanceItems', await db.getAll('maintenanceItems'))
}

export async function putMaintenanceItem(item: MaintenanceItem): Promise<void> {
  const db = await getDB()
  await db.put('maintenanceItems', (await seal('maintenanceItems', item)) as never)
}

export async function putMaintenanceItems(items: MaintenanceItem[]): Promise<void> {
  const sealed = await sealAll('maintenanceItems', items)
  const db = await getDB()
  const tx = db.transaction('maintenanceItems', 'readwrite')
  await Promise.all(sealed.map((row) => tx.store.put(row as never)))
  await tx.done
}

export async function deleteMaintenanceItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('maintenanceItems', id)
}

export async function getFuelEntriesForCar(carId: string): Promise<FuelEntry[]> {
  const db = await getDB()
  const entries = await openAll<FuelEntry>('fuelEntries', await db.getAllFromIndex('fuelEntries', 'by-car', carId))
  return entries.sort((a, b) => a.mileage - b.mileage)
}

export async function getAllFuelEntriesRaw(): Promise<FuelEntry[]> {
  const db = await getDB()
  return openAll<FuelEntry>('fuelEntries', await db.getAll('fuelEntries'))
}

export async function putFuelEntry(entry: FuelEntry): Promise<void> {
  const db = await getDB()
  await db.put('fuelEntries', (await seal('fuelEntries', entry)) as never)
}

export async function deleteFuelEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('fuelEntries', id)
}

export async function getHistoryForCar(carId: string): Promise<HistoryEntry[]> {
  const db = await getDB()
  const entries = await openAll<HistoryEntry>('history', await db.getAllFromIndex('history', 'by-car', carId))
  return entries.sort((a, b) => b.date - a.date)
}

export async function getAllHistoryRaw(): Promise<HistoryEntry[]> {
  const db = await getDB()
  return openAll<HistoryEntry>('history', await db.getAll('history'))
}

export async function putHistoryEntry(entry: HistoryEntry): Promise<void> {
  const db = await getDB()
  await db.put('history', (await seal('history', entry)) as never)
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('history', id)
}

/**
 * Replaces the entire database (every store) in one all-or-nothing
 * transaction. Used by backup restore/import, where a partial failure
 * halfway through a sequence of separate clear+put calls would otherwise
 * leave IndexedDB emptied but not repopulated — invisible until the next
 * reload, when the app finds no cars and drops the user into onboarding.
 */
export async function replaceAll(data: {
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
}): Promise<void> {
  // Encrypt first: awaiting crypto inside an IndexedDB transaction would let it auto-commit.
  const [cars, items, fuel, history, reminders, masters, expenses, components, trips, documents] = await Promise.all([
    sealAll('cars', data.cars),
    sealAll('maintenanceItems', data.items),
    sealAll('fuelEntries', data.fuel),
    sealAll('history', data.history),
    sealAll('reminders', data.reminders),
    sealAll('masters', data.masters),
    sealAll('expenses', data.expenses),
    sealAll('components', data.components),
    sealAll('trips', data.trips),
    sealAll('documents', data.documents),
  ])
  const db = await getDB()
  const tx = db.transaction(ALL_STORES, 'readwrite')
  await Promise.all(ALL_STORES.map((name) => tx.objectStore(name).clear()))
  const write = (name: StoreName, rows: unknown[]) => rows.map((r) => tx.objectStore(name).put(r as never))
  await Promise.all([
    ...write('cars', cars),
    ...write('maintenanceItems', items),
    ...write('fuelEntries', fuel),
    ...write('history', history),
    ...write('reminders', reminders),
    ...write('masters', masters),
    ...write('expenses', expenses),
    ...write('components', components),
    ...write('trips', trips),
    ...write('documents', documents),
  ])
  await tx.done
}

export async function getRemindersForCar(carId: string): Promise<Reminder[]> {
  const db = await getDB()
  const reminders = await openAll<Reminder>('reminders', await db.getAllFromIndex('reminders', 'by-car', carId))
  return reminders.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAllRemindersRaw(): Promise<Reminder[]> {
  const db = await getDB()
  return openAll<Reminder>('reminders', await db.getAll('reminders'))
}

export async function putReminder(reminder: Reminder): Promise<void> {
  const db = await getDB()
  await db.put('reminders', (await seal('reminders', reminder)) as never)
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('reminders', id)
}

export async function getMastersForCar(carId: string): Promise<Master[]> {
  const db = await getDB()
  const masters = await openAll<Master>('masters', await db.getAllFromIndex('masters', 'by-car', carId))
  return masters.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAllMastersRaw(): Promise<Master[]> {
  const db = await getDB()
  return openAll<Master>('masters', await db.getAll('masters'))
}

export async function putMaster(master: Master): Promise<void> {
  const db = await getDB()
  await db.put('masters', (await seal('masters', master)) as never)
}

export async function deleteMaster(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('masters', id)
}

export async function getExpensesForCar(carId: string): Promise<Expense[]> {
  const db = await getDB()
  const expenses = await openAll<Expense>('expenses', await db.getAllFromIndex('expenses', 'by-car', carId))
  return expenses.sort((a, b) => b.date - a.date)
}

export async function getAllExpensesRaw(): Promise<Expense[]> {
  const db = await getDB()
  return openAll<Expense>('expenses', await db.getAll('expenses'))
}

export async function putExpense(expense: Expense): Promise<void> {
  const db = await getDB()
  await db.put('expenses', (await seal('expenses', expense)) as never)
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('expenses', id)
}

export async function getComponentsForCar(carId: string): Promise<ComponentCheck[]> {
  const db = await getDB()
  const components = await openAll<ComponentCheck>('components', await db.getAllFromIndex('components', 'by-car', carId))
  return components.sort((a, b) => b.date - a.date)
}

export async function getAllComponentsRaw(): Promise<ComponentCheck[]> {
  const db = await getDB()
  return openAll<ComponentCheck>('components', await db.getAll('components'))
}

export async function putComponentCheck(component: ComponentCheck): Promise<void> {
  const db = await getDB()
  await db.put('components', (await seal('components', component)) as never)
}

export async function deleteComponentCheck(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('components', id)
}

export async function getTripsForCar(carId: string): Promise<Trip[]> {
  const db = await getDB()
  const trips = await openAll<Trip>('trips', await db.getAllFromIndex('trips', 'by-car', carId))
  return trips.sort((a, b) => b.date - a.date)
}

export async function getAllTripsRaw(): Promise<Trip[]> {
  const db = await getDB()
  return openAll<Trip>('trips', await db.getAll('trips'))
}

export async function putTrip(trip: Trip): Promise<void> {
  const db = await getDB()
  await db.put('trips', (await seal('trips', trip)) as never)
}

export async function deleteTrip(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('trips', id)
}

export async function getDocumentsForCar(carId: string): Promise<CarDocument[]> {
  const db = await getDB()
  const documents = await openAll<CarDocument>('documents', await db.getAllFromIndex('documents', 'by-car', carId))
  return documents.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAllDocumentsRaw(): Promise<CarDocument[]> {
  const db = await getDB()
  return openAll<CarDocument>('documents', await db.getAll('documents'))
}

export async function putDocument(document: CarDocument): Promise<void> {
  const db = await getDB()
  await db.put('documents', (await seal('documents', document)) as never)
}

export async function putDocuments(documents: CarDocument[]): Promise<void> {
  const sealed = await sealAll('documents', documents)
  const db = await getDB()
  const tx = db.transaction('documents', 'readwrite')
  await Promise.all(sealed.map((row) => tx.store.put(row as never)))
  await tx.done
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('documents', id)
}


export interface RecordCounts {
  plain: number
  sealed: number
}

/** How many stored records are encrypted and how many are not (to resume an interrupted migration). */
export async function countRecords(): Promise<RecordCounts> {
  const db = await getDB()
  const counts: RecordCounts = { plain: 0, sealed: 0 }
  for (const name of ALL_STORES) {
    for (const row of await db.getAll(name)) {
      if (isSealed(row)) counts.sealed++
      else counts.plain++
    }
  }
  return counts
}

/**
 * Rewrites every record in place: `seal` encrypts the ones still in the clear,
 * `unseal` decrypts the encrypted ones. Idempotent, and all-or-nothing: the new
 * rows are computed first and written in a single transaction, so a failure
 * leaves the database exactly as it was.
 */
export async function reencryptAll(mode: 'seal' | 'unseal', onProgress?: (done: number, total: number) => void): Promise<number> {
  const db = await getDB()
  const pending: { name: StoreName; row: unknown }[] = []
  let total = 0
  for (const name of ALL_STORES) {
    for (const raw of await db.getAll(name)) {
      const sealed = isSealed(raw)
      if (mode === 'seal' ? !sealed : sealed) total++
      pending.push({ name, row: raw })
    }
  }
  const rewritten: { name: StoreName; row: unknown }[] = []
  let done = 0
  for (const { name, row } of pending) {
    const sealed = isSealed(row)
    if (mode === 'seal' && !sealed) {
      rewritten.push({ name, row: await seal(name, row as Row) })
    } else if (mode === 'unseal' && sealed) {
      rewritten.push({ name, row: await open(name, row) })
    } else {
      continue
    }
    onProgress?.(++done, total)
  }
  if (rewritten.length === 0) return 0
  const tx = db.transaction(ALL_STORES, 'readwrite')
  await Promise.all(rewritten.map(({ name, row }) => tx.objectStore(name).put(row as never)))
  await tx.done
  return rewritten.length
}
