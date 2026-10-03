import { META_ENABLED, setMeta } from './alertStore'

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
  // The service worker can't read localStorage, so mirror the switch where it can.
  void setMeta(META_ENABLED, enabled && getNotificationPermission() === 'granted').catch(() => {})
}

/** True when notifications are switched on in the app and the browser permits them. */
export function canNotify(): boolean {
  return isNotificationsEnabled() && getNotificationPermission() === 'granted'
}

/**
 * Shows a notification through the service worker when there is one (it also
 * makes tapping it open the app), falling back to the page's own Notification.
 * `tag` replaces an earlier notification with the same tag instead of stacking.
 */
export async function showLocalNotification(title: string, body: string, tag?: string): Promise<void> {
  if (getNotificationPermission() !== 'granted') return

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, icon: ICON, badge: ICON, tag, data: { url: registration.scope } })
      return
    }
  }
  new Notification(title, { body, icon: ICON, tag })
}

/** Sends a notification right now, to confirm the whole chain (permission, worker, system settings) works. */
export async function sendTestNotification(): Promise<'sent' | 'no-permission' | 'unsupported' | 'failed'> {
  if (!isNotificationApiSupported()) return 'unsupported'
  if (getNotificationPermission() !== 'granted') return 'no-permission'
  try {
    await showLocalNotification('Моя машина', 'Уведомления работают. Так будут приходить напоминания о ТО, документах и сроках.', `test-${Date.now()}`)
    return 'sent'
  } catch {
    return 'failed'
  }
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
  if (!canNotify()) return
  if (localStorage.getItem(key) === 'true') return

  await showLocalNotification('Заканчивается топливо', `Прогноз запаса хода: ~${Math.round(rangeKm)} км`)
  localStorage.setItem(key, 'true')
}

const BUDGET_KEY = (carId: string) => `my-car-budget-notified-${carId}`

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/**
 * Notifies when the month's spending crosses 80% and again at 100% of the
 * budget — each level once per calendar month.
 */
export async function checkAndNotifyBudget(carId: string, spent: number, budget: number | null, now = Date.now()): Promise<void> {
  if (!budget || !canNotify()) return
  const d = new Date(now)
  const month = `${d.getFullYear()}-${d.getMonth() + 1}`
  const level = spent > budget ? 100 : spent >= budget * 0.8 ? 80 : 0
  if (level === 0) return

  // Keys look like "2026-10:80"; drop other months so the list can't grow forever.
  const done = readList(BUDGET_KEY(carId)).filter((k) => k.startsWith(`${month}:`))
  const key = `${month}:${level}`
  if (done.includes(key)) return

  const body =
    level === 100
      ? `Потрачено ${Math.round(spent).toLocaleString('ru-RU')} из ${Math.round(budget).toLocaleString('ru-RU')} — бюджет превышен`
      : `Потрачено ${Math.round(spent).toLocaleString('ru-RU')} из ${Math.round(budget).toLocaleString('ru-RU')} (80% бюджета)`
  await showLocalNotification('Бюджет на месяц', body)
  // Crossing 100% also covers the 80% notice for this month.
  const next = level === 100 ? [...done, `${month}:80`, key] : [...done, key]
  localStorage.setItem(BUDGET_KEY(carId), JSON.stringify(next))
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
