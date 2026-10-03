import { EXPENSE_CATEGORY_LABELS } from '../../types'
import type { Expense, FuelEntry, HistoryEntry } from '../../types'

export interface CostShare {
  key: string
  label: string
  amount: number
  /** 0..1 share of the total. */
  share: number
}

/**
 * Where the money goes: fuel, service (split into parts / labor when the
 * entries carry a breakdown) and every other-expense category. Biggest first,
 * zero rows omitted.
 */
export function buildCostStructure(
  fuel: Pick<FuelEntry, 'cost'>[],
  history: Pick<HistoryEntry, 'cost' | 'items'>[],
  expenses: Pick<Expense, 'amount' | 'category'>[],
): CostShare[] {
  const totals = new Map<string, { label: string; amount: number }>()
  const add = (key: string, label: string, amount: number) => {
    if (!(amount > 0)) return
    const row = totals.get(key)
    if (row) row.amount += amount
    else totals.set(key, { label, amount })
  }

  for (const f of fuel) add('fuel', 'Топливо', f.cost ?? 0)

  for (const h of history) {
    const cost = h.cost ?? 0
    let part = 0
    let labor = 0
    for (const i of h.items ?? []) {
      if (i.kind === 'part') part += i.amount
      else if (i.kind === 'labor') labor += i.amount
    }
    // Never let a breakdown that overshoots the total produce a negative rest.
    const itemized = Math.min(part + labor, cost)
    const scale = part + labor > 0 ? itemized / (part + labor) : 0
    add('service-part', 'ТО · детали', part * scale)
    add('service-labor', 'ТО · работа', labor * scale)
    add('service-rest', 'ТО', cost - itemized)
  }

  for (const e of expenses) add(`expense-${e.category}`, EXPENSE_CATEGORY_LABELS[e.category], e.amount)

  const sum = [...totals.values()].reduce((s, r) => s + r.amount, 0)
  return [...totals.entries()]
    .map(([key, r]) => ({ key, label: r.label, amount: r.amount, share: sum > 0 ? r.amount / sum : 0 }))
    .sort((a, b) => b.amount - a.amount)
}
