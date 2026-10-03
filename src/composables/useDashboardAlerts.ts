import { watch, type ComputedRef } from 'vue'
import { useCarStore } from './useCarStore'
import { registerBackgroundCheck, runAlertsNow, scheduleAlertCycle } from './useAlerts'
import { checkAndNotifyBudget, checkAndNotifyLowFuel, updateAppBadge } from '../utils/alerts/notifications'
import { monthlyBudget } from '../utils/money/budget'

/**
 * Keeps the app badge, the low-fuel / budget checks and the alert engine in step with the data. Returns the handler
 * for "notifications were just enabled", which has no data change to react to.
 */
export function useDashboardAlerts(thisMonthSpend: ComputedRef<number>, warrantyKeys: ComputedRef<string[]>) {
  const { car, statuses, dueCount, soonCount, estimatedRangeKm, reminderStatuses, documentStatuses } = useCarStore()

  watch(
    [car, statuses],
    () => {
      updateAppBadge(dueCount.value + soonCount.value)
    },
    { immediate: true },
  )

  watch(
    [car, estimatedRangeKm],
    ([carVal, rangeVal]) => {
      if (carVal) checkAndNotifyLowFuel(carVal.id, rangeVal)
    },
    { immediate: true },
  )

  watch(
    [car, thisMonthSpend, monthlyBudget],
    ([carVal, spent, budget]) => {
      if (carVal) checkAndNotifyBudget(carVal.id, spent, budget)
    },
    { immediate: true },
  )

  /** A change in anything the alert engine reads re-runs it (debounced), for every car. */
  watch(
    () => [
      car.value?.currentMileage,
      statuses.value.map((x) => `${x.item.id}:${x.state}`).join(),
      reminderStatuses.value.map((x) => `${x.reminder.id}:${x.isDue}`).join(),
      documentStatuses.value.map((x) => `${x.document.id}:${x.document.expiryDate}`).join(),
      warrantyKeys.value.join(),
    ],
    () => scheduleAlertCycle(),
  )

  /** Enabling notifications doesn't change any data, so run the checks once for what is already due. */
  function handleNotificationsEnabled() {
    void runAlertsNow()
    void registerBackgroundCheck()
    if (!car.value) return
    checkAndNotifyLowFuel(car.value.id, estimatedRangeKm.value)
    checkAndNotifyBudget(car.value.id, thisMonthSpend.value, monthlyBudget.value)
  }

  return { handleNotificationsEnabled }
}
