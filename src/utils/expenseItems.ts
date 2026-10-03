import { EXPENSE_ITEM_KIND_LABELS } from '../types'
import type { ExpenseItem } from '../types'

/** One-line description of a breakdown row, e.g. "Деталь: колодки — 3 000 ₽ · гарантия 12 мес.". */
export function itemLine(item: ExpenseItem, money: (n: number) => string): string {
  const warranty = item.warrantyMonths ? ` · гарантия ${item.warrantyMonths} мес.` : ''
  return `${EXPENSE_ITEM_KIND_LABELS[item.kind]}: ${item.name || '—'} — ${money(item.amount)}${warranty}`
}
