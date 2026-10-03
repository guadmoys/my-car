import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
})

import * as db from '../../db/database'
import { listSnapshots, saveSnapshot } from '../../utils/autoBackup'
import {
  VaultAuthError,
  VaultLockedError,
  getVaultMeta,
  isVaultEnabled,
  isVaultUnlocked,
  lockVault,
  saveVaultMeta,
  serializeBackup,
  unlockVault,
  type KdfParams,
} from '../../utils/vault'
import { resolveBackupData } from '../../utils/backupFile'
import {
  cancelPreparedEncryption,
  commitEncryption,
  disableEncryption,
  prepareEncryption,
  resumeInterruptedMigration,
} from '../../utils/vaultActions'
import { downloadBackup as _unused } from '../../utils/cloudSync'

void _unused

const FAST: KdfParams = { name: 'argon2id', m: 64, t: 1, p: 1 }
const PASS = 'a long and sturdy passphrase'

type Store = ReturnType<typeof import('../useCarStore').useCarStore>
let store: Store

/** Reads every stored row exactly as IndexedDB holds it, bypassing the app's decryption. */
async function rawRows(storeName: string): Promise<Record<string, unknown>[]> {
  const database = await new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open('my-car-db')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  const rows = await new Promise<Record<string, unknown>[]>((res, rej) => {
    const r = database.transaction(storeName).objectStore(storeName).getAll()
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  database.close()
  return rows
}

async function everythingStored(): Promise<string> {
  const names = ['cars', 'maintenanceItems', 'fuelEntries', 'history', 'reminders', 'masters', 'expenses', 'components', 'trips', 'documents']
  return JSON.stringify(await Promise.all(names.map(rawRows)))
}

beforeAll(async () => {
  store = (await import('../useCarStore')).useCarStore()
  await store.load()
  await store.createCar({ make: 'Ford', model: 'Focus', year: 2018, initialMileage: 1000 })
  await store.addExpense({ category: 'damage', title: 'Секретный бампер', amount: 4242 })
  await store.addDocument({ type: 'insurance', title: 'Полис 7777', number: 'XYZ-123', photos: [] })
  await saveSnapshot(await store.exportData(), 'daily')
})

describe('encryption at rest', () => {
  it('starts in the clear', async () => {
    const stored = await everythingStored()
    expect(stored).toContain('Ford')
    expect(stored).toContain('Секретный бампер')
  })

  it('rolls back completely if encryption cannot finish', async () => {
    const created = await prepareEncryption(PASS, FAST)
    lockVault() // the key disappears before anything can be sealed
    await expect(commitEncryption(created)).rejects.toBeInstanceOf(VaultLockedError)
    expect(isVaultEnabled()).toBe(false)
    expect(await everythingStored()).toContain('Ford')
  })

  it('encrypts every record, keeps the app working, and drops readable snapshots', async () => {
    const created = await prepareEncryption(PASS, FAST)
    let lastProgress = 0
    await commitEncryption(created, (done) => (lastProgress = done))
    expect(lastProgress).toBeGreaterThan(0)
    expect(isVaultEnabled()).toBe(true)

    const stored = await everythingStored()
    for (const secret of ['Ford', 'Focus', 'Секретный бампер', '4242', 'Полис 7777', 'XYZ-123']) {
      expect(stored).not.toContain(secret)
    }
    // Only ids and the by-car key remain visible.
    for (const row of await rawRows('expenses')) {
      expect(Object.keys(row).sort()).toEqual(['carId', 'ct', 'e', 'id', 'iv'])
    }
    expect((await listSnapshots()).length).toBe(0)

    // Reads and writes go through transparently while unlocked.
    await store.addExpense({ category: 'fine', title: 'Новый штраф', amount: 500 })
    expect(await everythingStored()).not.toContain('Новый штраф')
    const loaded = await db.getExpensesForCar(store.car.value!.id)
    expect(loaded.map((e) => e.title)).toContain('Новый штраф')
  })

  it('keeps new snapshots encrypted and readable only while unlocked', async () => {
    await saveSnapshot(await store.exportData(), 'daily')
    const raw = JSON.stringify(await new Promise((res) => {
      const r = indexedDB.open('my-car-snapshots')
      r.onsuccess = () => {
        const g = r.result.transaction('snapshots').objectStore('snapshots').getAll()
        g.onsuccess = () => res(g.result)
      }
    }))
    expect(raw).not.toContain('Ford')
    expect((await listSnapshots()).length).toBe(1)
    lockVault()
    expect((await listSnapshots()).length).toBe(0)
    await unlockVault({ passphrase: PASS })
  })

  it('refuses to read or write while locked, and a wrong passphrase does not open it', async () => {
    lockVault()
    await expect(db.getAllCars()).rejects.toBeInstanceOf(VaultLockedError)
    await expect(db.putCar({ id: 'x' } as never)).rejects.toBeInstanceOf(VaultLockedError)
    await expect(unlockVault({ passphrase: 'not the passphrase' })).rejects.toBeInstanceOf(VaultAuthError)
    expect(isVaultUnlocked()).toBe(false)
    await unlockVault({ passphrase: PASS })
    expect((await db.getAllCars()).length).toBeGreaterThan(0)
  })

  it('does not let a stored record be swapped for another', async () => {
    const rows = await rawRows('expenses')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    const [a, b] = rows
    // Put b's ciphertext under a's id, as an attacker with write access to storage might.
    const forged = { ...b, id: a.id }
    const database = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open('my-car-db')
      r.onsuccess = () => res(r.result)
    })
    await new Promise<void>((res) => {
      const tx = database.transaction('expenses', 'readwrite')
      tx.objectStore('expenses').put(forged)
      tx.oncomplete = () => res()
    })
    database.close()
    await expect(db.getAllExpensesRaw()).rejects.toThrow()
    // Restore the original so later tests see consistent data.
    const restore = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open('my-car-db')
      r.onsuccess = () => res(r.result)
    })
    await new Promise<void>((res) => {
      const tx = restore.transaction('expenses', 'readwrite')
      tx.objectStore('expenses').put(a)
      tx.oncomplete = () => res()
    })
    restore.close()
    expect((await db.getAllExpensesRaw()).length).toBe(rows.length)
  })

  it('produces encrypted exports that import back, with the passphrase or recovery path', async () => {
    const backup = await store.exportData()
    const text = await serializeBackup(backup)
    expect(text).not.toContain('Ford')
    const parsed = JSON.parse(text)
    const ask = vi.fn(async () => PASS)

    // Same device, unlocked: no prompt at all.
    const same = await resolveBackupData(parsed, ask)
    expect(same.ok).toBe(true)
    expect(ask).not.toHaveBeenCalled()

    // Locked (e.g. fresh start): asks, and a wrong first answer is retried.
    lockVault()
    const answers = ['wrong wrong wrong', PASS]
    const retry = await resolveBackupData(parsed, async () => answers.shift() ?? null)
    expect(retry.ok).toBe(true)
    if (retry.ok) expect((retry.data as { cars: unknown[] }).cars.length).toBeGreaterThan(0)

    const cancelled = await resolveBackupData(parsed, async () => null)
    expect(cancelled).toEqual({ ok: false, error: 'Отменено' })
    await unlockVault({ passphrase: PASS })
  })

  it('imports a backup into an encrypted database as encrypted rows', async () => {
    const backup = await store.exportData()
    const result = await store.importData(JSON.parse(JSON.stringify(backup)))
    expect(result).toEqual({ ok: true })
    expect(await everythingStored()).not.toContain('Секретный бампер')
    expect(store.expenses.map((e) => e.title)).toContain('Секретный бампер')
  })

  it('finishes an interrupted migration on the next unlock', async () => {
    // Simulate rows written in the clear while the vault is on (crash mid-migration).
    await db.putCar({ id: 'plain-car', make: 'Lada', model: 'Niva', year: 2001, initialMileage: 0, currentMileage: 0, createdAt: 1, updatedAt: 1 })
    const meta = getVaultMeta()!
    const plainDb = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open('my-car-db')
      r.onsuccess = () => res(r.result)
    })
    await new Promise<void>((res) => {
      const tx = plainDb.transaction('cars', 'readwrite')
      tx.objectStore('cars').put({ id: 'plain-car', make: 'Lada', model: 'Niva' })
      tx.oncomplete = () => res()
    })
    plainDb.close()
    expect((await db.countRecords()).plain).toBe(1)
    await resumeInterruptedMigration()
    expect((await db.countRecords()).plain).toBe(0)
    expect(await everythingStored()).not.toContain('Niva')
    expect(getVaultMeta()).toEqual(meta)
  })

  it('decrypts everything when turned off, but only with the right passphrase', async () => {
    await expect(disableEncryption({ passphrase: 'nope nope nope nope' })).rejects.toBeInstanceOf(VaultAuthError)
    expect(isVaultEnabled()).toBe(true)
    expect(await everythingStored()).not.toContain('Ford')

    await disableEncryption({ passphrase: PASS })
    expect(isVaultEnabled()).toBe(false)
    const stored = await everythingStored()
    expect(stored).toContain('Ford')
    expect(stored).toContain('Секретный бампер')
    expect(isVaultUnlocked()).toBe(false)
    // And the app reads it again without any vault.
    expect((await db.getAllCars()).length).toBeGreaterThan(0)
  })

  it('discarding a prepared vault leaves nothing behind', async () => {
    await prepareEncryption(PASS, FAST)
    expect(isVaultUnlocked()).toBe(true)
    cancelPreparedEncryption()
    expect(isVaultUnlocked()).toBe(false)
    expect(isVaultEnabled()).toBe(false)
    expect(saveVaultMeta).toBeTypeOf('function')
  })
})
