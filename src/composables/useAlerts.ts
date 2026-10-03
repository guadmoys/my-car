import { runAlertCycle } from '../utils/alerts/alertDispatcher'
import { META_ENABLED, setMeta } from '../utils/alerts/alertStore'
import { canNotify, showLocalNotification } from '../utils/alerts/notifications'
import { isVaultEnabled, isVaultUnlocked } from '../utils/security/vault'

let running: Promise<void> | null = null
let rerun = false
let timer: ReturnType<typeof setTimeout> | undefined

/**
 * Runs the alert engine over every car right now. Overlapping calls are
 * folded: one in flight plus at most one queued behind it.
 */
export function runAlertsNow(): Promise<void> {
  // Encrypted data can't be read (or checked) while locked.
  if (isVaultEnabled() && !isVaultUnlocked()) return Promise.resolve()
  if (running) {
    rerun = true
    return running
  }
  running = (async () => {
    try {
      const allowed = canNotify()
      await setMeta(META_ENABLED, allowed)
      await runAlertCycle({ canNotify: allowed, notify: (title, body, tag) => showLocalNotification(title, body, tag) })
    } catch {
      /* a failed pass is retried on the next trigger */
    } finally {
      running = null
      if (rerun) {
        rerun = false
        void runAlertsNow()
      }
    }
  })()
  return running
}

/** Debounced: many quick edits cause one pass, after the database writes have settled. */
export function scheduleAlertCycle(delayMs = 1500): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void runAlertsNow(), delayMs)
}

export type BackgroundStatus = 'active' | 'unsupported' | 'blocked' | 'off'

const SYNC_TAG = 'my-car-alerts'
/** The browser decides the real cadence (often 12 h or more), this is only the shortest it may use. */
const MIN_INTERVAL_MS = 12 * 60 * 60 * 1000

interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>
  unregister(tag: string): Promise<void>
  getTags(): Promise<string[]>
}

async function periodicSync(): Promise<PeriodicSyncManager | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const manager = (registration as unknown as { periodicSync?: PeriodicSyncManager } | null)?.periodicSync
  return manager ?? null
}

/** Asks the browser to wake the worker periodically (Chromium, installed app). Resolves with what happened. */
export async function registerBackgroundCheck(): Promise<BackgroundStatus> {
  if (isVaultEnabled()) return 'off'
  const manager = await periodicSync()
  if (!manager) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName })
    if (status.state !== 'granted') return 'blocked'
    await manager.register(SYNC_TAG, { minInterval: MIN_INTERVAL_MS })
    return 'active'
  } catch {
    return 'blocked'
  }
}

export async function unregisterBackgroundCheck(): Promise<void> {
  try {
    await (await periodicSync())?.unregister(SYNC_TAG)
  } catch {
    /* nothing to undo */
  }
}

/** Whether the background check is currently set up, for the Settings screen. */
export async function backgroundStatus(): Promise<BackgroundStatus> {
  if (isVaultEnabled()) return 'off'
  const manager = await periodicSync()
  if (!manager) return 'unsupported'
  try {
    return (await manager.getTags()).includes(SYNC_TAG) ? 'active' : 'off'
  } catch {
    return 'unsupported'
  }
}
