import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Car, MaintenanceItem } from '../types'

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
}

const DB_NAME = 'my-car-db'
const DB_VERSION = 1

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
  await db.put('car', car)
}

export async function getAllMaintenanceItems(): Promise<MaintenanceItem[]> {
  const db = await getDB()
  const items = await db.getAllFromIndex('maintenanceItems', 'by-order')
  return items
}

export async function putMaintenanceItem(item: MaintenanceItem): Promise<void> {
  const db = await getDB()
  await db.put('maintenanceItems', item)
}

export async function putMaintenanceItems(items: MaintenanceItem[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('maintenanceItems', 'readwrite')
  await Promise.all(items.map((item) => tx.store.put(item)))
  await tx.done
}

export async function deleteMaintenanceItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('maintenanceItems', id)
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['car', 'maintenanceItems'], 'readwrite')
  await Promise.all([tx.objectStore('car').clear(), tx.objectStore('maintenanceItems').clear()])
  await tx.done
}
