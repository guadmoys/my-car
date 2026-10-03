/**
 * When to nudge the user to save a copy of their data off the device.
 * Everything here is plain numbers in localStorage; the actual saving lives in
 * backupExport.ts.
 */
const INTERVAL_KEY = 'my-car-backup-interval-days'
const LAST_KEY = 'my-car-backup-last'
const FIRST_SEEN_KEY = 'my-car-backup-first-seen'
const SNOOZE_KEY = 'my-car-backup-snooze-until'

export const DAY_MS = 24 * 60 * 60 * 1000

export const BACKUP_INTERVAL_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: 'Каждый день' },
  { days: 7, label: 'Раз в неделю' },
  { days: 14, label: 'Раз в 2 недели' },
  { days: 30, label: 'Раз в месяц' },
  { days: 0, label: 'Не напоминать' },
]

/** Weekly by default: losing a year of records is the worst thing this app can do, and a reminder costs one tap. */
const DEFAULT_INTERVAL_DAYS = 7

function num(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function put(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* best effort */
  }
}

export function getBackupIntervalDays(): number {
  const n = num(INTERVAL_KEY)
  return n !== null && n >= 0 ? n : DEFAULT_INTERVAL_DAYS
}

export function setBackupIntervalDays(days: number): void {
  put(INTERVAL_KEY, Math.max(0, Math.round(days)))
}

export function getLastBackupAt(): number | null {
  return num(LAST_KEY)
}

export function markBackupDone(now = Date.now()): void {
  put(LAST_KEY, now)
  localStorage.removeItem(SNOOZE_KEY)
}

/** "Later": stay quiet for a day (or `days`). */
export function snoozeBackup(now = Date.now(), days = 1): void {
  put(SNOOZE_KEY, now + days * DAY_MS)
}

export interface BackupState {
  /** Whether to show the reminder now. */
  due: boolean
  /** Whole days since the last copy (or since the app first saw data when none was ever made); null when unknown. */
  daysSince: number | null
  /** True when no copy was ever made. */
  never: boolean
}

/**
 * `externalAt` is the time of the newest copy made some other way, e.g. a
 * successful cloud sync, which counts as a backup too.
 */
export function backupState(opts: { hasData: boolean; now?: number; externalAt?: number | null }): BackupState {
  const now = opts.now ?? Date.now()
  if (!opts.hasData) return { due: false, daysSince: null, never: false }

  // The clock starts when the app first holds data, so a new user isn't nagged on day one.
  let firstSeen = num(FIRST_SEEN_KEY)
  if (firstSeen === null) {
    firstSeen = now
    put(FIRST_SEEN_KEY, now)
  }
  const last = Math.max(getLastBackupAt() ?? 0, opts.externalAt ?? 0)
  const reference = last > 0 ? last : firstSeen
  const daysSince = Math.floor((now - reference) / DAY_MS)

  const interval = getBackupIntervalDays()
  const snoozedUntil = num(SNOOZE_KEY) ?? 0
  const due = interval > 0 && now - reference >= interval * DAY_MS && now >= snoozedUntil
  return { due, daysSince, never: last === 0 }
}

/** "никогда", "сегодня", "вчера", "5 дней назад". */
export function describeLastBackup(at: number | null, now = Date.now()): string {
  if (at === null) return 'ещё не делали'
  const days = Math.floor((now - at) / DAY_MS)
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  const mod10 = days % 10
  const mod100 = days % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 'дня' : 'дней'
  return `${days} ${word} назад`
}
