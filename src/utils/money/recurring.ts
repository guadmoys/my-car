import type { Expense, ExpenseRecurrence } from '../../types'

const MAX_CATCH_UP = 36

/** The date one period after `from`, keeping the series anchored to `anchorDay` (clamped to the month's length). */
export function nextOccurrence(from: number, rec: ExpenseRecurrence): number {
  const d = new Date(from)
  const monthsToAdd = rec.every === 'year' ? 12 : 1
  const target = new Date(d.getFullYear(), d.getMonth() + monthsToAdd, 1, d.getHours(), d.getMinutes(), d.getSeconds())
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(rec.anchorDay, lastDay))
  return target.getTime()
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

/** True when the list already holds the entry a series would create (same day, title, category, amount). */
function alreadyExists(expenses: Expense[], from: Expense, date: number): boolean {
  return expenses.some(
    (e) =>
      e.id !== from.id &&
      !e.recurrence &&
      e.category === from.category &&
      (e.title ?? '') === (from.title ?? '') &&
      e.amount === from.amount &&
      sameDay(e.date, date),
  )
}

export interface RecurringResult {
  /** Heads whose recurrence moved on to a newly created entry (recurrence cleared). */
  updated: Expense[]
  /** Newly created entries; the newest one of each series carries the recurrence. */
  created: Expense[]
}

/**
 * Creates the entries a repeating expense owes up to `now`. Idempotent: the
 * recurrence marker moves from the old head to the newest created entry, so
 * running it twice creates nothing the second time.
 */
export function materializeRecurring(expenses: Expense[], now: number, makeId: () => string): RecurringResult {
  const updated: Expense[] = []
  const created: Expense[] = []
  for (const head of expenses) {
    const rec = head.recurrence
    if (!rec) continue
    let last = head
    let date = nextOccurrence(head.date, rec)
    let steps = 0
    const series: Expense[] = []
    while (date <= now && steps < MAX_CATCH_UP) {
      const { recurrence: _drop, receiptPhoto: _photo, photos: _photos, ...rest } = last
      if (!alreadyExists(expenses, head, date)) {
        series.push({ ...rest, id: makeId(), date, items: last.items?.map((i) => ({ ...i })) })
        last = series[series.length - 1]
      }
      date = nextOccurrence(date, rec)
      steps++
    }
    if (series.length === 0) continue
    series[series.length - 1] = { ...series[series.length - 1], recurrence: rec }
    updated.push({ ...head, recurrence: undefined })
    created.push(...series)
  }
  return { updated, created }
}
