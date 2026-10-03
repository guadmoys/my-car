import type {
  CostForecast,
  FuelConsumption,
  FuelInsight,
  MaintenanceItem,
  MaintenanceStatus,
  ReminderStatus,
  TimelineEvent,
} from '../../types'
import { currency } from '../../utils/currency'
import {
  analyzeConsumption,
  averageFuelPrice,
  buildFuelInsights,
  estimatedRange,
  forecastCosts,
  monthDistance,
  totalCo2Kg,
} from '../../utils/fuelAnalytics'
import type { ConsumptionAnalysis } from '../../utils/fuelAnalytics'
import { averageDailyKm, maintenanceStatus } from '../../utils/maintenance'
import { computed } from 'vue'
import { car, expenses, fuelEntries, historyEntries, items, reminders } from './state'

export const DAY_MS = 24 * 60 * 60 * 1000

export const avgDailyKm = computed<number | null>(() => averageDailyKm(fuelEntries))

export function statusFor(
  item: MaintenanceItem,
  currentMileage: number,
  now: number,
  dailyKm: number | null,
): MaintenanceStatus {
  const itemHistory = historyEntries.filter((h) => h.itemId === item.id)
  return maintenanceStatus(item, currentMileage, now, dailyKm, itemHistory)
}

export const statuses = computed<MaintenanceStatus[]>(() => {
  if (!car.value) return []
  const now = Date.now()
  const dailyKm = avgDailyKm.value
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => statusFor(item, car.value!.currentMileage, now, dailyKm))
})

export const dueCount = computed(
  () => statuses.value.filter((s) => s.state === 'due').length,
)

export const soonCount = computed(
  () => statuses.value.filter((s) => s.state === 'soon').length,
)

export const okCount = computed(
  () => statuses.value.filter((s) => s.state === 'ok').length,
)

/** Due-first, then oldest-added-first (km-based and date-based reminders aren't directly comparable, so no finer sort). */
export const reminderStatuses = computed<ReminderStatus[]>(() => {
  if (!car.value) return []
  const now = Date.now()
  const mileage = car.value.currentMileage
  return reminders
    .map((reminder) => {
      const remainingKm = reminder.dueMileage !== undefined ? reminder.dueMileage - mileage : undefined
      const remainingDays =
        reminder.dueDate !== undefined ? Math.ceil((reminder.dueDate - now) / DAY_MS) : undefined
      const isDue = (remainingKm !== undefined && remainingKm <= 0) || (remainingDays !== undefined && remainingDays <= 0)
      return { reminder, isDue, remainingKm, remainingDays }
    })
    .sort((a, b) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1
      return a.reminder.createdAt - b.reminder.createdAt
    })
})

// (fuel analytics live in utils/fuelAnalytics.ts)

export const consumptionAnalysis = computed<ConsumptionAnalysis>(() => {
  if (!car.value) return { history: [], average: null, currentLevelLiters: null }
  return analyzeConsumption(fuelEntries, car.value)
})

export const averageConsumption = computed<number | null>(() => consumptionAnalysis.value.average)

export const fuelHistory = computed<FuelConsumption[]>(() => consumptionAnalysis.value.history)

export const estimatedRangeKm = computed<number | null>(() =>
  estimatedRange(consumptionAnalysis.value.currentLevelLiters, averageConsumption.value),
)

export const averageFuelPriceValue = computed<number | null>(() => averageFuelPrice(fuelEntries))

export const totalCo2KgValue = computed<number>(() => totalCo2Kg(fuelEntries))

export const fuelInsights = computed<FuelInsight[]>(() => {
  if (!car.value) return []
  return buildFuelInsights({
    car: car.value,
    fuelEntries,
    history: fuelHistory.value,
    averageConsumption: averageConsumption.value,
    rangeKm: estimatedRangeKm.value,
    dailyKm: avgDailyKm.value,
    currency: currency.value,
    now: Date.now(),
  })
})

export const monthDistanceKm = computed<number | null>(() => {
  if (!car.value) return null
  return monthDistance(car.value, fuelEntries, historyEntries, Date.now())
})

/** Fuel fill-ups, completed maintenance and other expenses, merged into one date-sorted feed. */
export const timelineEvents = computed<TimelineEvent[]>(() => {
  const fuel: TimelineEvent[] = fuelEntries.map((e) => ({
    kind: 'fuel',
    id: e.id,
    date: e.date,
    mileage: e.mileage,
    entry: e,
  }))
  const service: TimelineEvent[] = historyEntries.map((h) => ({
    kind: 'service',
    id: h.id,
    date: h.date,
    mileage: h.mileage,
    entry: h,
  }))
  const other: TimelineEvent[] = expenses.map((e) => ({
    kind: 'expense',
    id: e.id,
    date: e.date,
    mileage: null,
    entry: e,
  }))
  return [...fuel, ...service, ...other].sort((a, b) => b.date - a.date)
})

export const totalFuelCost = computed(() =>
  fuelEntries.reduce((sum, e) => sum + (e.cost ?? 0), 0),
)

export const totalServiceCost = computed(() =>
  historyEntries.reduce((sum, h) => sum + (h.cost ?? 0), 0),
)

export const totalExpensesCost = computed(() => expenses.reduce((sum, e) => sum + e.amount, 0))

export const totalCost = computed(() => totalFuelCost.value + totalServiceCost.value + totalExpensesCost.value)

export const hasAnyCost = computed(
  () =>
    fuelEntries.some((e) => e.cost !== undefined) ||
    historyEntries.some((h) => h.cost !== undefined) ||
    expenses.length > 0,
)

export const costForecast = computed<{ sixMonths: CostForecast | null; twelveMonths: CostForecast | null }>(() => {
  if (!car.value) return { sixMonths: null, twelveMonths: null }
  return forecastCosts({ fuelEntries, historyEntries, items, dailyKm: avgDailyKm.value, now: Date.now() })
})

