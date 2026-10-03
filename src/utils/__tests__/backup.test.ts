import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})

import {
  DAY_MS,
  backupState,
  describeLastBackup,
  getBackupIntervalDays,
  markBackupDone,
  setBackupIntervalDays,
  snoozeBackup,
} from '../backup/backupSchedule'
import { KEEP_FILES, backupFileName, canShareFiles, folderReady, saveBackup, writeToFolder } from '../backup/backupExport'

const T0 = new Date(2026, 5, 1, 12, 0).getTime()

beforeEach(() => memory.clear())

describe('backup schedule', () => {
  it('is weekly by default and stays quiet until the first week has passed', () => {
    expect(getBackupIntervalDays()).toBe(7)
    expect(backupState({ hasData: true, now: T0 }).due).toBe(false) // starts the clock
    expect(backupState({ hasData: true, now: T0 + 6 * DAY_MS }).due).toBe(false)
    const s = backupState({ hasData: true, now: T0 + 7 * DAY_MS })
    expect(s).toMatchObject({ due: true, daysSince: 7, never: true })
  })

  it('never nags an empty app', () => {
    expect(backupState({ hasData: false, now: T0 }).due).toBe(false)
    expect(backupState({ hasData: false, now: T0 + 90 * DAY_MS }).due).toBe(false)
  })

  it('restarts the clock after a backup, and "later" silences it for a day', () => {
    backupState({ hasData: true, now: T0 })
    markBackupDone(T0 + 8 * DAY_MS)
    expect(backupState({ hasData: true, now: T0 + 14 * DAY_MS }).due).toBe(false)
    expect(backupState({ hasData: true, now: T0 + 15 * DAY_MS }).due).toBe(true)
    snoozeBackup(T0 + 15 * DAY_MS)
    expect(backupState({ hasData: true, now: T0 + 15.5 * DAY_MS }).due).toBe(false)
    expect(backupState({ hasData: true, now: T0 + 16.1 * DAY_MS }).due).toBe(true)
  })

  it('counts a recent cloud sync as a backup', () => {
    backupState({ hasData: true, now: T0 })
    const s = backupState({ hasData: true, now: T0 + 20 * DAY_MS, externalAt: T0 + 19 * DAY_MS })
    expect(s.due).toBe(false)
    expect(s.never).toBe(false)
  })

  it('honours a custom interval and "do not remind"', () => {
    backupState({ hasData: true, now: T0 })
    setBackupIntervalDays(1)
    expect(backupState({ hasData: true, now: T0 + DAY_MS }).due).toBe(true)
    setBackupIntervalDays(0)
    expect(backupState({ hasData: true, now: T0 + 365 * DAY_MS }).due).toBe(false)
  })

  it('describes the last backup in Russian', () => {
    expect(describeLastBackup(null)).toBe('ещё не делали')
    expect(describeLastBackup(T0, T0 + 1000)).toBe('сегодня')
    expect(describeLastBackup(T0, T0 + DAY_MS)).toBe('вчера')
    expect(describeLastBackup(T0, T0 + 3 * DAY_MS)).toBe('3 дня назад')
    expect(describeLastBackup(T0, T0 + 5 * DAY_MS)).toBe('5 дней назад')
    expect(describeLastBackup(T0, T0 + 11 * DAY_MS)).toBe('11 дней назад')
    expect(describeLastBackup(T0, T0 + 21 * DAY_MS)).toBe('21 день назад')
  })
})

function fakeFolder(opts: { permission?: PermissionState; existing?: string[] } = {}) {
  const files = new Map<string, string>((opts.existing ?? []).map((n) => [n, 'old']))
  let permission: PermissionState = opts.permission ?? 'granted'
  const dir = {
    name: 'Backups',
    queryPermission: async () => permission,
    requestPermission: async () => ((permission = 'granted'), permission),
    getFileHandle: async (name: string) => ({
      createWritable: async () => ({
        write: async (data: string) => void files.set(name, data),
        close: async () => undefined,
      }),
    }),
    removeEntry: async (name: string) => void files.delete(name),
    entries: async function* () {
      for (const name of files.keys()) yield [name, { kind: 'file' as const }] as [string, { kind: 'file' }]
    },
  }
  return { dir, files, setPermission: (p: PermissionState) => (permission = p) }
}

describe('saving to a folder', () => {
  it('writes the file and keeps only the newest copies', async () => {
    const existing = Array.from({ length: KEEP_FILES + 2 }, (_, i) => `moya-mashina-backup-2026-01-${String(i + 1).padStart(2, '0')}.json`)
    existing.push('my-own-notes.txt')
    const f = fakeFolder({ existing })
    expect(await writeToFolder(f.dir, 'moya-mashina-backup-2026-06-01.json', '{"x":1}')).toBe(true)
    expect(f.files.get('moya-mashina-backup-2026-06-01.json')).toBe('{"x":1}')
    const backups = [...f.files.keys()].filter((n) => n.startsWith('moya-mashina-backup-'))
    expect(backups).toHaveLength(KEEP_FILES)
    expect(f.files.has('moya-mashina-backup-2026-01-01.json')).toBe(false) // oldest pruned
    expect(f.files.has('my-own-notes.txt')).toBe(true) // never touches other files
  })

  it('does not write without permission unless a tap may ask for it', async () => {
    const f = fakeFolder({ permission: 'prompt' })
    expect(await folderReady(f.dir)).toBe(false)
    expect(await writeToFolder(f.dir, 'a.json', 'x')).toBe(false)
    expect(f.files.size).toBe(0)
    expect(await writeToFolder(f.dir, 'moya-mashina-backup-2026-06-01.json', 'x', true)).toBe(true)
    expect(await folderReady(f.dir)).toBe(true)
  })

  it('reports failure instead of throwing', async () => {
    const f = fakeFolder()
    f.dir.getFileHandle = async () => {
      throw new Error('disk full')
    }
    expect(await writeToFolder(f.dir, 'a.json', 'x')).toBe(false)
  })
})

describe('saveBackup without a folder', () => {
  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('moya-mashina-backup-2026-01-05.json')
  })

  it('uses the share sheet when files can be shared, and treats closing it as cancelled', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await saveBackup('a.json', '{}')).toEqual({ ok: true, method: 'share' })
    expect(share).toHaveBeenCalledTimes(1)
    share.mockRejectedValueOnce(new DOMException('closed', 'AbortError'))
    expect(await saveBackup('a.json', '{}')).toEqual({ ok: false, reason: 'cancelled' })
  })

  it('falls back to a download when sharing is refused', async () => {
    const clicks: string[] = []
    vi.stubGlobal('navigator', { share: async () => { throw new Error('NotAllowed') }, canShare: () => true })
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined })
    vi.stubGlobal('document', {
      createElement: () => ({ click: () => clicks.push('click'), set href(_v: string) {}, set download(_v: string) {} }),
      body: { appendChild: () => undefined, removeChild: () => undefined },
    })
    expect(await saveBackup('a.json', '{}')).toEqual({ ok: true, method: 'download' })
    expect(clicks).toEqual(['click'])
  })

  it('knows when file sharing is unavailable', () => {
    vi.stubGlobal('navigator', {})
    expect(canShareFiles(new File(['x'], 'a.json'))).toBe(false)
  })
})
