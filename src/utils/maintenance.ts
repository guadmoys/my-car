import type { FuelEntry, MaintenanceItem, MaintenanceStatus } from '../types'
import { adaptiveDayThreshold, adaptiveKmThreshold } from './adaptiveThreshold'
import { addMonthsClamped, DAY_MS } from './dates'

/** Fewer than this many days between the first and last fill-up is a burst, not a driving pace. */
const MIN_PACE_DAYS = 3
/** Beyond ~3 years a daily-pace guess for a long-interval item is noise, not a useful date. */
const MAX_ESTIMATE_DAYS = 1095

/**
 * Average km driven per day, from the span of the fuel history. Guarded
 * against a short/burst date span so backfilling several fill-ups in one
 * sitting doesn't produce a wild rate.
 */
export function averageDailyKm(fuelEntries: Pick<FuelEntry, 'date' | 'mileage'>[]): number | null {
  if (fuelEntries.length < 2) return null
  const sorted = fuelEntries.slice().sort((a, b) => a.date - b.date)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const days = (last.date - first.date) / DAY_MS
  const distance = last.mileage - first.mileage
  if (days < MIN_PACE_DAYS || distance <= 0) return null
  return distance / days
}

function stateRank(state: MaintenanceStatus['state']): number {
  return state === 'due' ? 2 : state === 'soon' ? 1 : 0
}

export interface DetailedStatus extends MaintenanceStatus {
  /** km before the due point at which the item flips to "soon". */
  kmSoonThreshold: number
  /** Days before the due date at which the item flips to "soon"; null when it has no date interval. */
  daySoonThreshold: number | null
}

/**
 * Where one maintenance item stands. Pure: everything it needs comes in as
 * arguments, so it works for any car, not just the one open in the UI.
 * `itemHistory` is the completed-service history of this item.
 */
export function maintenanceStatus(
  item: MaintenanceItem,
  currentMileage: number,
  now: number,
  dailyKm: number | null,
  itemHistory: { mileage: number; date: number }[],
): DetailedStatus {
  const dueAtMileage = item.lastServiceMileage + item.intervalKm
  const remainingKm = dueAtMileage - currentMileage
  const traveled = currentMileage - item.lastServiceMileage
  const kmProgress = item.intervalKm > 0 ? Math.min(1, Math.max(0, traveled / item.intervalKm)) : 1
  const kmSoonThreshold = adaptiveKmThreshold(
    item.intervalKm,
    item.notifyBeforeKm,
    itemHistory.map((h) => h.mileage),
  ).value
  const kmState: MaintenanceStatus['state'] = remainingKm <= 0 ? 'due' : remainingKm <= kmSoonThreshold ? 'soon' : 'ok'

  let dueAtDate: number | undefined
  let remainingDays: number | undefined
  let dateState: MaintenanceStatus['state'] | null = null
  let dateProgress = 0
  let daySoonThreshold: number | null = null

  if (item.intervalMonths && item.lastServiceDate) {
    dueAtDate = addMonthsClamped(item.lastServiceDate, item.intervalMonths)
    remainingDays = Math.ceil((dueAtDate - now) / DAY_MS)
    const totalSpan = dueAtDate - item.lastServiceDate
    dateProgress = totalSpan > 0 ? Math.min(1, Math.max(0, (now - item.lastServiceDate) / totalSpan)) : 1
    daySoonThreshold = adaptiveDayThreshold(
      totalSpan,
      item.notifyBeforeDays,
      itemHistory.map((h) => h.date),
    ).value
    dateState = remainingDays <= 0 ? 'due' : remainingDays <= daySoonThreshold ? 'soon' : 'ok'
  }

  let estimatedDueDate: number | undefined
  if (dueAtDate === undefined && dailyKm !== null && dailyKm > 0 && remainingKm > 0) {
    const daysUntil = remainingKm / dailyKm
    if (daysUntil <= MAX_ESTIMATE_DAYS) estimatedDueDate = now + daysUntil * DAY_MS
  }

  const state = dateState && stateRank(dateState) > stateRank(kmState) ? dateState : kmState
  const progress = dateState ? Math.max(kmProgress, dateProgress) : kmProgress

  return {
    item,
    dueAtMileage,
    remainingKm,
    dueAtDate,
    remainingDays,
    estimatedDueDate,
    progress,
    state,
    kmSoonThreshold,
    daySoonThreshold,
  }
}
