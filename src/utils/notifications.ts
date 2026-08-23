import type { MaintenanceStatus } from '../types'

const ENABLED_KEY = 'my-car-notifications-enabled'
const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`

export function isNotificationApiSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission {
  return isNotificationApiSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationApiSupported()) return 'denied'
  return Notification.requestPermission()
}

export function isNotificationsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false')
}

async function showLocalNotification(title: string, body: string): Promise<void> {
  if (getNotificationPermission() !== 'granted') return

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, icon: ICON, badge: ICON })
      return
    }
  }
  new Notification(title, { body, icon: ICON })
}

function notifiedKey(carId: string): string {
  return `my-car-notified-${carId}`
}

function getNotifiedIds(carId: string): Set<string> {
  try {
    const raw = localStorage.getItem(notifiedKey(carId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveNotifiedIds(carId: string, ids: Set<string>): void {
  localStorage.setItem(notifiedKey(carId), JSON.stringify([...ids]))
}

/** Call when an item is marked serviced, so it can notify again next time it becomes due. */
export function clearNotifiedItem(carId: string, itemId: string): void {
  const ids = getNotifiedIds(carId)
  if (ids.delete(itemId)) saveNotifiedIds(carId, ids)
}

/**
 * Notifies about newly due/soon items for this car that haven't been
 * notified about yet (tracked per-car so switching cars doesn't spam, and
 * so an item only re-notifies after it's serviced and becomes due again).
 */
export async function checkAndNotify(carId: string, statuses: MaintenanceStatus[]): Promise<void> {
  if (!isNotificationsEnabled() || getNotificationPermission() !== 'granted') return

  const dueOrSoon = statuses.filter((s) => s.state === 'due' || s.state === 'soon')
  const notifiedIds = getNotifiedIds(carId)
  const fresh = dueOrSoon.filter((s) => !notifiedIds.has(s.item.id))
  if (fresh.length === 0) return

  const title = fresh.length === 1 ? fresh[0].item.name : `Пора обслужить: ${fresh.length} параметров`
  const body =
    fresh.length === 1
      ? fresh[0].state === 'due'
        ? 'Просрочено ТО'
        : 'Скоро пора на ТО'
      : fresh.map((s) => s.item.name).join(', ')

  await showLocalNotification(title, body)

  for (const s of fresh) notifiedIds.add(s.item.id)
  saveNotifiedIds(carId, notifiedIds)
}

const LOW_FUEL_RANGE_KM = 60

function lowFuelNotifiedKey(carId: string): string {
  return `my-car-low-fuel-notified-${carId}`
}

/**
 * Notifies once when the estimated range drops at or below the threshold,
 * then stays quiet until it recovers above it (a refill) so it can fire
 * again next time fuel runs low.
 */
export async function checkAndNotifyLowFuel(carId: string, rangeKm: number | null): Promise<void> {
  const key = lowFuelNotifiedKey(carId)
  if (rangeKm === null || rangeKm > LOW_FUEL_RANGE_KM) {
    localStorage.removeItem(key)
    return
  }
  if (!isNotificationsEnabled() || getNotificationPermission() !== 'granted') return
  if (localStorage.getItem(key) === 'true') return

  await showLocalNotification('Заканчивается топливо', `Прогноз запаса хода: ~${Math.round(rangeKm)} км`)
  localStorage.setItem(key, 'true')
}

export function updateAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (count > 0 && nav.setAppBadge) {
    nav.setAppBadge(count).catch(() => {})
  } else if (nav.clearAppBadge) {
    nav.clearAppBadge().catch(() => {})
  }
}
