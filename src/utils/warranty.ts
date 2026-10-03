import type { Expense, HistoryEntry } from '../types'

export interface WarrantyStatus {
  key: string
  name: string
  source: string
  endsAt: number
  remainingDays: number
}

function addMonths(ts: number, months: number): number {
  const d = new Date(ts)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return target.getTime()
}

/** Parts still under warranty, soonest to expire first. Expired warranties are dropped. */
export function buildWarranties(
  history: Pick<HistoryEntry, 'id' | 'date' | 'itemName' | 'items'>[],
  expenses: Pick<Expense, 'id' | 'date' | 'title' | 'items'>[],
  now: number,
): WarrantyStatus[] {
  const result: WarrantyStatus[] = []
  const push = (id: string, date: number, source: string, items: Expense['items']) => {
    for (const item of items ?? []) {
      if (item.kind !== 'part' || !item.warrantyMonths || item.warrantyMonths <= 0) continue
      const endsAt = addMonths(date, item.warrantyMonths)
      if (endsAt < now) continue
      result.push({
        key: `${id}-${item.id}`,
        name: item.name || 'Деталь',
        source,
        endsAt,
        remainingDays: Math.ceil((endsAt - now) / 86400000),
      })
    }
  }
  for (const h of history) push(h.id, h.date, h.itemName, h.items)
  for (const e of expenses) push(e.id, e.date, e.title || 'Расход', e.items)
  return result.sort((a, b) => a.endsAt - b.endsAt)
}
