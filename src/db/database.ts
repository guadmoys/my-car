import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Car, FuelEntry, HistoryEntry, MaintenanceItem } from '../types'

interface MyCarDB extends DBSchema {
  car: {
    key: string
    value: Car
  }
  maintenanceItems: {
    key: string
    value: MaintenanceItem
    indexes: { 'by-order': number }
  }
  fuelEntries: {
    key: string
    value: FuelEntry
    indexes: { 'by-mileage': number }
  }
  history: {
    key: string
    value: HistoryEntry
    indexes: { 'by-date': number }
  }
}

const DB_NAME = 'my-car-db'
const DB_VERSION = 3

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
      upgrade(db) {
        if (!db.objectStoreNames.contains('car')) {
          db.createObjectStore('car', { keyPath: 'id' })
        }
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
      },
    })
  }
  return dbPromise
}

export async function getCar(): Promise<Car | undefined> {
  const db = await getDB()
  return db.get('car', 'main')
}

export async function putCar(car: Car): Promise<void> {
  const db = await getDB()
  await db.put('car', toPlain(car))
}

export async function getAllMaintenanceItems(): Promise<MaintenanceItem[]> {
  const db = await getDB()
  const items = await db.getAllFromIndex('maintenanceItems', 'by-order')
  return items
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

export async function getAllFuelEntries(): Promise<FuelEntry[]> {
  const db = await getDB()
  return db.getAllFromIndex('fuelEntries', 'by-mileage')
}

export async function putFuelEntry(entry: FuelEntry): Promise<void> {
  const db = await getDB()
  await db.put('fuelEntries', toPlain(entry))
}

export async function putFuelEntries(entries: FuelEntry[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('fuelEntries', 'readwrite')
  await Promise.all(entries.map((entry) => tx.store.put(toPlain(entry))))
  await tx.done
}

export async function deleteFuelEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('fuelEntries', id)
}

export async function getAllHistoryEntries(): Promise<HistoryEntry[]> {
  const db = await getDB()
  return db.getAllFromIndex('history', 'by-date')
}

export async function putHistoryEntry(entry: HistoryEntry): Promise<void> {
  const db = await getDB()
  await db.put('history', toPlain(entry))
}

export async function putHistoryEntries(entries: HistoryEntry[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('history', 'readwrite')
  await Promise.all(entries.map((entry) => tx.store.put(toPlain(entry))))
  await tx.done
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('history', id)
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['car', 'maintenanceItems', 'fuelEntries', 'history'], 'readwrite')
  await Promise.all([
    tx.objectStore('car').clear(),
    tx.objectStore('maintenanceItems').clear(),
    tx.objectStore('fuelEntries').clear(),
    tx.objectStore('history').clear(),
  ])
  await tx.done
}
