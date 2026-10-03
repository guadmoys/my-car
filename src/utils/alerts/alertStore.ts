import { openDB, type DBSchema } from 'idb'
import type { Note } from './alerts'

/**
 * A tiny database of its own (plain, not the encrypted app database) that both
 * the page and the service worker can read: which alerts were already shown,
 * the upcoming notifications for the background check, and the on/off flag.
 * It holds only opaque keys, times and the notification texts — and the texts
 * are never written while encryption is on.
 */
interface AlertDB extends DBSchema {
  schedule: { key: string; value: Note }
  shown: { key: string; value: { key: string; at: number } }
  meta: { key: string; value: { k: string; v: unknown } }
}

export const ALERT_DB_NAME = 'my-car-alerts'
const KEEP_SHOWN_MS = 400 * 24 * 60 * 60 * 1000

// One shared connection: opening a new one per call would leak handles and block upgrades.
let dbPromise: ReturnType<typeof openDB<AlertDB>> | null = null

const open = () => {
  if (!dbPromise) {
    dbPromise = openDB<AlertDB>(ALERT_DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('schedule', { keyPath: 'key' })
        db.createObjectStore('shown', { keyPath: 'key' })
        db.createObjectStore('meta', { keyPath: 'k' })
      },
    })
  }
  return dbPromise
}

/** Empties everything (used by tests and when the user turns notifications off for good). */
export async function resetAlertStore(): Promise<void> {
  const db = await open()
  const tx = db.transaction(['schedule', 'shown', 'meta'], 'readwrite')
  await Promise.all([tx.objectStore('schedule').clear(), tx.objectStore('shown').clear(), tx.objectStore('meta').clear()])
  await tx.done
}

export async function readShown(): Promise<Set<string>> {
  const db = await open()
  return new Set((await db.getAllKeys('shown')) as string[])
}

export async function markShown(keys: string[], now = Date.now()): Promise<void> {
  if (keys.length === 0) return
  const db = await open()
  const tx = db.transaction('shown', 'readwrite')
  await Promise.all(keys.map((key) => tx.store.put({ key, at: now })))
  await tx.done
}

/** Forgets keys shown more than a year ago so the list can't grow forever. */
export async function pruneShown(now = Date.now()): Promise<void> {
  const db = await open()
  const tx = db.transaction('shown', 'readwrite')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if (now - cursor.value.at > KEEP_SHOWN_MS) await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

/** Replaces the whole schedule (an empty list clears it). */
export async function writeSchedule(notes: Note[]): Promise<void> {
  const db = await open()
  const tx = db.transaction('schedule', 'readwrite')
  await tx.store.clear()
  await Promise.all(notes.map((n) => tx.store.put(n)))
  await tx.done
}

export async function readSchedule(): Promise<Note[]> {
  const db = await open()
  return (await db.getAll('schedule')).sort((a, b) => a.at - b.at)
}

export async function getMeta<T>(k: string): Promise<T | undefined> {
  const db = await open()
  return (await db.get('meta', k))?.v as T | undefined
}

export async function setMeta(k: string, v: unknown): Promise<void> {
  const db = await open()
  await db.put('meta', { k, v })
}

/** The service worker checks this: it has no access to localStorage. */
export const META_ENABLED = 'enabled'
export const META_BASELINE = 'baseline'
export const META_LAST_CHECK = 'lastCheck'
