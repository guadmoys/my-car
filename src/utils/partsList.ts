import { EXPENSE_CATEGORY_LABELS } from '../types'
import type { Expense, ExpenseItem, HistoryEntry } from '../types'

export interface PartRow {
  key: string
  item: ExpenseItem
  date: number
  /** Where the line came from: the ТО name or the expense title/category. */
  source: string
  origin: 'service' | 'expense'
  masterId?: string
}

/** Every breakdown line across service history and expenses, newest first. */
export function buildPartsList(
  history: Pick<HistoryEntry, 'id' | 'date' | 'itemName' | 'items' | 'masterId'>[],
  expenses: Pick<Expense, 'id' | 'date' | 'title' | 'category' | 'items' | 'masterId'>[],
): PartRow[] {
  const rows: PartRow[] = []
  for (const h of history) {
    for (const item of h.items ?? []) {
      rows.push({ key: `${h.id}-${item.id}`, item, date: h.date, source: h.itemName, origin: 'service', masterId: h.masterId })
    }
  }
  for (const e of expenses) {
    for (const item of e.items ?? []) {
      rows.push({
        key: `${e.id}-${item.id}`,
        item,
        date: e.date,
        source: e.title || EXPENSE_CATEGORY_LABELS[e.category],
        origin: 'expense',
        masterId: e.masterId,
      })
    }
  }
  return rows.sort((a, b) => b.date - a.date)
}
