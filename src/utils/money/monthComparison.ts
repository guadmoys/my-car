import type { Expense, FuelEntry, HistoryEntry } from '../../types'

export interface MonthTotals {
  fuel: number
  service: number
  other: number
  total: number
}

export interface MonthComparison {
  current: MonthTotals
  previous: MonthTotals
  /** (current - previous) / previous; null when there is nothing to compare with. */
  changePct: number | null
  /** Which part moved the most in absolute terms, with its signed change. */
  biggestMover: { key: 'fuel' | 'service' | 'other'; label: string; delta: number } | null
}

function totalsFor(
  from: number,
  to: number,
  fuel: Pick<FuelEntry, 'date' | 'cost'>[],
  history: Pick<HistoryEntry, 'date' | 'cost'>[],
  expenses: Pick<Expense, 'date' | 'amount'>[],
): MonthTotals {
  const inRange = (t: number) => t >= from && t < to
  const f = fuel.filter((e) => inRange(e.date)).reduce((s, e) => s + (e.cost ?? 0), 0)
  const s = history.filter((e) => inRange(e.date)).reduce((sum, e) => sum + (e.cost ?? 0), 0)
  const o = expenses.filter((e) => inRange(e.date)).reduce((sum, e) => sum + e.amount, 0)
  return { fuel: f, service: s, other: o, total: f + s + o }
}

/** This calendar month against the previous one. */
export function compareMonths(
  fuel: Pick<FuelEntry, 'date' | 'cost'>[],
  history: Pick<HistoryEntry, 'date' | 'cost'>[],
  expenses: Pick<Expense, 'date' | 'amount'>[],
  now: number,
): MonthComparison {
  const d = new Date(now)
  const curFrom = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const curTo = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  const prevFrom = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()
  const current = totalsFor(curFrom, curTo, fuel, history, expenses)
  const previous = totalsFor(prevFrom, curFrom, fuel, history, expenses)

  const parts = [
    { key: 'fuel' as const, label: 'Топливо', delta: current.fuel - previous.fuel },
    { key: 'service' as const, label: 'ТО', delta: current.service - previous.service },
    { key: 'other' as const, label: 'Прочее', delta: current.other - previous.other },
  ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {
    current,
    previous,
    changePct: previous.total > 0 ? (current.total - previous.total) / previous.total : null,
    biggestMover: parts[0] && parts[0].delta !== 0 ? parts[0] : null,
  }
}
