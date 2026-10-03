import type { Expense, HistoryEntry } from '../types'

export interface MasterStats {
  count: number
  total: number
  /** Sum of the «Работа» lines, when the entries carry a breakdown. */
  labor: number
  laborCount: number
}

/** Visits, spend and labor per master id, from service history and expenses. */
export function buildMasterStats(
  history: Pick<HistoryEntry, 'masterId' | 'cost' | 'items'>[],
  expenses: Pick<Expense, 'masterId' | 'amount' | 'items'>[],
): Map<string, MasterStats> {
  const stats = new Map<string, MasterStats>()
  const add = (masterId: string | undefined, total: number, items: Expense['items']) => {
    if (!masterId) return
    let s = stats.get(masterId)
    if (!s) stats.set(masterId, (s = { count: 0, total: 0, labor: 0, laborCount: 0 }))
    s.count++
    s.total += total
    for (const i of items ?? []) {
      if (i.kind === 'labor') {
        s.labor += i.amount
        s.laborCount++
      }
    }
  }
  for (const h of history) add(h.masterId, h.cost ?? 0, h.items)
  for (const e of expenses) add(e.masterId, e.amount, e.items)
  return stats
}
