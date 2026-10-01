import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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
  return db.getAll('cars')
}

export async function putCar(car: Car): Promise<void> {
  const db = await getDB()
  await db.put('cars', toPlain(car))
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
  const items = await db.getAllFromIndex('maintenanceItems', 'by-car', carId)
  return items.sort((a, b) => a.order - b.order)
}

export async function getAllMaintenanceItemsRaw(): Promise<MaintenanceItem[]> {
  const db = await getDB()
  return db.getAll('maintenanceItems')
}

export async function putMaintenanceItem(item: MaintenanceItem): Promise<void> {
  const db = await getDB()
  await db.put('maintenanceItems', toPlain(item))
}

export async function putMaintenanceItems(items: MaintenanceItem[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('maintenanceItems', 'readwrite')
  await Promise.all(items.map((item) => tx.store.put(toPlain(item))))
  await tx.done
}

export async function deleteMaintenanceItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('maintenanceItems', id)
}

export async function getFuelEntriesForCar(carId: string): Promise<FuelEntry[]> {
  const db = await getDB()
  const entries = await db.getAllFromIndex('fuelEntries', 'by-car', carId)
  return entries.sort((a, b) => a.mileage - b.mileage)
}

export async function getAllFuelEntriesRaw(): Promise<FuelEntry[]> {
  const db = await getDB()
  return db.getAll('fuelEntries')
}

export async function putFuelEntry(entry: FuelEntry): Promise<void> {
  const db = await getDB()
  await db.put('fuelEntries', toPlain(entry))
}

export async function deleteFuelEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('fuelEntries', id)
}

export async function getHistoryForCar(carId: string): Promise<HistoryEntry[]> {
  const db = await getDB()
  const entries = await db.getAllFromIndex('history', 'by-car', carId)
  return entries.sort((a, b) => b.date - a.date)
}

export async function getAllHistoryRaw(): Promise<HistoryEntry[]> {
  const db = await getDB()
  return db.getAll('history')
}

export async function putHistoryEntry(entry: HistoryEntry): Promise<void> {
  const db = await getDB()
  await db.put('history', toPlain(entry))
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
  const db = await getDB()
  const storeNames = [
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
  ] as const
  const tx = db.transaction(storeNames, 'readwrite')
  await Promise.all(storeNames.map((name) => tx.objectStore(name).clear()))
  await Promise.all([
    ...data.cars.map((c) => tx.objectStore('cars').put(toPlain(c))),
    ...data.items.map((i) => tx.objectStore('maintenanceItems').put(toPlain(i))),
    ...data.fuel.map((f) => tx.objectStore('fuelEntries').put(toPlain(f))),
    ...data.history.map((h) => tx.objectStore('history').put(toPlain(h))),
    ...data.reminders.map((r) => tx.objectStore('reminders').put(toPlain(r))),
    ...data.masters.map((m) => tx.objectStore('masters').put(toPlain(m))),
    ...data.expenses.map((e) => tx.objectStore('expenses').put(toPlain(e))),
    ...data.components.map((c) => tx.objectStore('components').put(toPlain(c))),
    ...data.trips.map((t) => tx.objectStore('trips').put(toPlain(t))),
    ...data.documents.map((d) => tx.objectStore('documents').put(toPlain(d))),
  ])
  await tx.done
}

export async function getRemindersForCar(carId: string): Promise<Reminder[]> {
  const db = await getDB()
  const reminders = await db.getAllFromIndex('reminders', 'by-car', carId)
  return reminders.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAllRemindersRaw(): Promise<Reminder[]> {
  const db = await getDB()
  return db.getAll('reminders')
}

export async function putReminder(reminder: Reminder): Promise<void> {
  const db = await getDB()
  await db.put('reminders', toPlain(reminder))
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('reminders', id)
}

export async function getMastersForCar(carId: string): Promise<Master[]> {
  const db = await getDB()
  const masters = await db.getAllFromIndex('masters', 'by-car', carId)
  return masters.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAllMastersRaw(): Promise<Master[]> {
  const db = await getDB()
  return db.getAll('masters')
}

export async function putMaster(master: Master): Promise<void> {
  const db = await getDB()
  await db.put('masters', toPlain(master))
}

export async function deleteMaster(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('masters', id)
}

export async function getExpensesForCar(carId: string): Promise<Expense[]> {
  const db = await getDB()
  const expenses = await db.getAllFromIndex('expenses', 'by-car', carId)
  return expenses.sort((a, b) => b.date - a.date)
}

export async function getAllExpensesRaw(): Promise<Expense[]> {
  const db = await getDB()
  return db.getAll('expenses')
}

export async function putExpense(expense: Expense): Promise<void> {
  const db = await getDB()
  await db.put('expenses', toPlain(expense))
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('expenses', id)
}

export async function getComponentsForCar(carId: string): Promise<ComponentCheck[]> {
  const db = await getDB()
  const components = await db.getAllFromIndex('components', 'by-car', carId)
  return components.sort((a, b) => b.date - a.date)
}

export async function getAllComponentsRaw(): Promise<ComponentCheck[]> {
  const db = await getDB()
  return db.getAll('components')
}

export async function putComponentCheck(component: ComponentCheck): Promise<void> {
  const db = await getDB()
  await db.put('components', toPlain(component))
}

export async function deleteComponentCheck(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('components', id)
}

export async function getTripsForCar(carId: string): Promise<Trip[]> {
  const db = await getDB()
  const trips = await db.getAllFromIndex('trips', 'by-car', carId)
  return trips.sort((a, b) => b.date - a.date)
}

export async function getAllTripsRaw(): Promise<Trip[]> {
  const db = await getDB()
  return db.getAll('trips')
}

export async function putTrip(trip: Trip): Promise<void> {
  const db = await getDB()
  await db.put('trips', toPlain(trip))
}

export async function deleteTrip(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('trips', id)
}

export async function getDocumentsForCar(carId: string): Promise<CarDocument[]> {
  const db = await getDB()
  const documents = await db.getAllFromIndex('documents', 'by-car', carId)
  return documents.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAllDocumentsRaw(): Promise<CarDocument[]> {
  const db = await getDB()
  return db.getAll('documents')
}

export async function putDocument(document: CarDocument): Promise<void> {
  const db = await getDB()
  await db.put('documents', toPlain(document))
}

export async function putDocuments(documents: CarDocument[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('documents', 'readwrite')
  await Promise.all(documents.map((d) => tx.store.put(toPlain(d))))
  await tx.done
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('documents', id)
}
