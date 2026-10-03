import { DOCUMENT_TYPE_LABELS } from '../types'
import type { DocumentStatus, MaintenanceStatus, ReminderStatus } from '../types'
import type { WarrantyStatus } from './warranty'

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

function remindersNotifiedKey(carId: string): string {
  return `my-car-reminders-notified-${carId}`
}

function getRemindersNotifiedIds(carId: string): Set<string> {
  try {
    const raw = localStorage.getItem(remindersNotifiedKey(carId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveRemindersNotifiedIds(carId: string, ids: Set<string>): void {
  localStorage.setItem(remindersNotifiedKey(carId), JSON.stringify([...ids]))
}

/** Call when a reminder is deleted, so its id can be reused without being treated as already-notified. */
export function clearNotifiedReminder(carId: string, reminderId: string): void {
  const ids = getRemindersNotifiedIds(carId)
  if (ids.delete(reminderId)) saveRemindersNotifiedIds(carId, ids)
}

/**
 * Notifies once per reminder when it becomes due (odometer or date/time
 * reached), tracked per-car like checkAndNotify above so it doesn't re-fire
 * on every reload while the reminder still sits in the list awaiting
 * deletion.
 */
export async function checkAndNotifyReminders(carId: string, dueStatuses: ReminderStatus[]): Promise<void> {
  if (!isNotificationsEnabled() || getNotificationPermission() !== 'granted') return

  const notifiedIds = getRemindersNotifiedIds(carId)
  const fresh = dueStatuses.filter((s) => !notifiedIds.has(s.reminder.id))
  if (fresh.length === 0) return

  const title = fresh.length === 1 ? 'Напоминание' : `Напоминания: ${fresh.length}`
  const body = fresh.map((s) => s.reminder.text).join(', ')
  await showLocalNotification(title, body)

  for (const s of fresh) notifiedIds.add(s.reminder.id)
  saveRemindersNotifiedIds(carId, notifiedIds)
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

function documentsNotifiedKey(carId: string): string {
  return `my-car-documents-notified-${carId}`
}

function getDocumentsNotifiedIds(carId: string): Set<string> {
  try {
    const raw = localStorage.getItem(documentsNotifiedKey(carId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveDocumentsNotifiedIds(carId: string, ids: Set<string>): void {
  localStorage.setItem(documentsNotifiedKey(carId), JSON.stringify([...ids]))
}

/** Call when a document is deleted or its expiry date changes, so it can notify again if it becomes due again. */
export function clearNotifiedDocument(carId: string, documentId: string): void {
  const ids = getDocumentsNotifiedIds(carId)
  if (ids.delete(documentId)) saveDocumentsNotifiedIds(carId, ids)
}

/**
 * Notifies once per document when its expiry date becomes due or soon
 * (insurance, tech inspection, licence, etc), tracked per-car like the
 * other checks above.
 */
export async function checkAndNotifyDocuments(carId: string, statuses: DocumentStatus[]): Promise<void> {
  if (!isNotificationsEnabled() || getNotificationPermission() !== 'granted') return

  const dueOrSoon = statuses.filter((s) => s.isDue || s.isSoon)
  const notifiedIds = getDocumentsNotifiedIds(carId)
  const fresh = dueOrSoon.filter((s) => !notifiedIds.has(s.document.id))
  if (fresh.length === 0) return

  const label = (s: DocumentStatus) => s.document.title || DOCUMENT_TYPE_LABELS[s.document.type]
  const title = fresh.length === 1 ? label(fresh[0]) : `Истекают документы: ${fresh.length}`
  const body =
    fresh.length === 1
      ? fresh[0].isDue
        ? 'Срок действия истёк'
        : `Срок действия истекает через ${fresh[0].remainingDays} дн.`
      : fresh.map(label).join(', ')

  await showLocalNotification(title, body)

  for (const s of fresh) notifiedIds.add(s.document.id)
  saveDocumentsNotifiedIds(carId, notifiedIds)
}

const BUDGET_KEY = (carId: string) => `my-car-budget-notified-${carId}`
const WARRANTY_KEY = (carId: string) => `my-car-warranty-notified-${carId}`

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
  if (!budget || !isNotificationsEnabled() || getNotificationPermission() !== 'granted') return
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

/** Notifies once per part when its warranty has 30 days or less left. */
export async function checkAndNotifyWarranties(carId: string, warranties: WarrantyStatus[]): Promise<void> {
  if (!isNotificationsEnabled() || getNotificationPermission() !== 'granted') return
  const done = new Set(readList(WARRANTY_KEY(carId)))
  const fresh = warranties.filter((w) => w.remainingDays <= 30 && !done.has(w.key))
  if (fresh.length === 0) return

  const title = fresh.length === 1 ? `Гарантия: ${fresh[0].name}` : `Заканчивается гарантия: ${fresh.length}`
  const body =
    fresh.length === 1
      ? `Осталось ${fresh[0].remainingDays} дн. — проверьте деталь, пока она на гарантии`
      : fresh.map((w) => w.name).join(', ')
  await showLocalNotification(title, body)
  for (const w of fresh) done.add(w.key)
  localStorage.setItem(WARRANTY_KEY(carId), JSON.stringify([...done]))
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
