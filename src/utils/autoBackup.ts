import { openDB, type DBSchema } from 'idb'
import type { BackupData } from '../types'

/**
 * Local safety-net copies of the whole database, kept in a *separate*
 * IndexedDB database so a failed schema upgrade, a bad import or a bad cloud
 * restore in the main one can't take the copies down with it.
 */
export type SnapshotReason = 'daily' | 'before-import'

export interface Snapshot {
  savedAt: number
  reason: SnapshotReason
  backup: BackupData
}

interface SnapshotDB extends DBSchema {
  snapshots: { key: number; value: Snapshot }
}

const DAY_MS = 24 * 60 * 60 * 1000
const KEEP_DAILY = 3
const KEEP_BEFORE_IMPORT = 2

const dbPromise = () =>
  openDB<SnapshotDB>('my-car-snapshots', 1, {
    upgrade(db) {
      db.createObjectStore('snapshots', { keyPath: 'savedAt' })
    },
  })

/** Returns the `savedAt` keys that should be deleted so each reason keeps only its newest few copies. */
export function snapshotsToPrune(list: Pick<Snapshot, 'savedAt' | 'reason'>[]): number[] {
  const limits: Record<SnapshotReason, number> = { daily: KEEP_DAILY, 'before-import': KEEP_BEFORE_IMPORT }
  const doomed: number[] = []
  for (const reason of Object.keys(limits) as SnapshotReason[]) {
    list
      .filter((s) => s.reason === reason)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(limits[reason])
      .forEach((s) => doomed.push(s.savedAt))
  }
  return doomed
}

/** Whether the newest daily copy is old enough that a fresh one is due. */
export function isDailySnapshotDue(list: Pick<Snapshot, 'savedAt' | 'reason'>[], now: number): boolean {
  const newest = list.filter((s) => s.reason === 'daily').reduce((max, s) => Math.max(max, s.savedAt), 0)
  return now - newest >= DAY_MS
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const db = await dbPromise()
  return (await db.getAll('snapshots')).sort((a, b) => b.savedAt - a.savedAt)
}

export async function saveSnapshot(backup: BackupData, reason: SnapshotReason): Promise<void> {
  // Never overwrite a good copy with an empty database.
  if (backup.cars.length === 0) return
  const db = await dbPromise()
  const savedAt = Date.now()
  await db.put('snapshots', { savedAt, reason, backup: JSON.parse(JSON.stringify(backup)) })
  for (const key of snapshotsToPrune(await db.getAll('snapshots'))) await db.delete('snapshots', key)
}

export async function dailySnapshotDue(): Promise<boolean> {
  return isDailySnapshotDue(await listSnapshots(), Date.now())
}
