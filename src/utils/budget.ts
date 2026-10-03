import { ref } from 'vue'
import type { Expense, FuelEntry, HistoryEntry } from '../types'

const STORAGE_KEY = 'my-car-monthly-budget'

function load(): number | null {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** Monthly spending limit on this device; null when not set. Reactive. */
export const monthlyBudget = ref<number | null>(load())

export function setMonthlyBudget(value: number | null): void {
  monthlyBudget.value = value && value > 0 ? value : null
  try {
    if (monthlyBudget.value === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(monthlyBudget.value))
  } catch {
    /* best effort */
  }
}

/** Everything spent in the calendar month containing `now`: fuel, service and other expenses. */
export function monthSpend(
  fuel: Pick<FuelEntry, 'date' | 'cost'>[],
  history: Pick<HistoryEntry, 'date' | 'cost'>[],
  expenses: Pick<Expense, 'date' | 'amount'>[],
  now: number,
): number {
  const d = new Date(now)
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  const inMonth = (t: number) => t >= from && t < to
  let sum = 0
  for (const f of fuel) if (inMonth(f.date)) sum += f.cost ?? 0
  for (const h of history) if (inMonth(h.date)) sum += h.cost ?? 0
  for (const e of expenses) if (inMonth(e.date)) sum += e.amount
  return sum
}
