import { EXPENSE_CATEGORY_LABELS } from '../../types'
import { addMonthsClamped, calendarDaysBetween } from '../dates'
import type { Expense, HistoryEntry } from '../../types'

export interface WarrantyStatus {
  key: string
  name: string
  source: string
  endsAt: number
  remainingDays: number
}

/** Parts still under warranty, soonest to expire first. Expired warranties are dropped. */
export function buildWarranties(
  history: Pick<HistoryEntry, 'id' | 'date' | 'itemName' | 'items'>[],
  expenses: Pick<Expense, 'id' | 'date' | 'title' | 'category' | 'items'>[],
  now: number,
): WarrantyStatus[] {
  const result: WarrantyStatus[] = []
  const push = (id: string, date: number, source: string, items: Expense['items']) => {
    for (const item of items ?? []) {
      if (item.kind !== 'part' || !item.warrantyMonths || item.warrantyMonths <= 0) continue
      const endsAt = addMonthsClamped(date, item.warrantyMonths)
      // Valid through the whole last day, so compare calendar days, not instants.
      const remainingDays = calendarDaysBetween(now, endsAt)
      if (remainingDays < 0) continue
      result.push({
        key: `${id}-${item.id}`,
        name: item.name || 'Деталь',
        source,
        endsAt,
        remainingDays,
      })
    }
  }
  for (const h of history) push(h.id, h.date, h.itemName, h.items)
  for (const e of expenses) push(e.id, e.date, e.title || EXPENSE_CATEGORY_LABELS[e.category], e.items)
  return result.sort((a, b) => a.endsAt - b.endsAt)
}
