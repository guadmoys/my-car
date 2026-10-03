import { describe, expect, it } from 'vitest'
import { materializeRecurring, nextOccurrence } from '../recurring'
import type { Expense } from '../../types'

const base: Expense = {
  id: 'e0',
  carId: 'c',
  category: 'loan',
  amount: 100,
  date: new Date(2026, 0, 31).getTime(),
  recurrence: { every: 'month', anchorDay: 31 },
}

describe('recurring expenses', () => {
  it('clamps to month length and returns to the anchor day', () => {
    const feb = nextOccurrence(base.date, base.recurrence!)
    expect(new Date(feb).getDate()).toBe(28)
    const mar = nextOccurrence(feb, base.recurrence!)
    expect(new Date(mar).getDate()).toBe(31)
  })

  it('creates every missed entry and moves the marker to the newest', () => {
    let n = 0
    const { updated, created } = materializeRecurring([base], new Date(2026, 3, 15).getTime(), () => `n${n++}`)
    expect(created).toHaveLength(2) // Feb 28, Mar 31; Apr 30 is still ahead
    expect(updated).toHaveLength(1)
    expect(created[1].recurrence).toBeDefined()
    expect(created[0].recurrence).toBeUndefined()
  })

  it('is idempotent once applied', () => {
    let n = 0
    const now = new Date(2026, 3, 15).getTime()
    const first = materializeRecurring([base], now, () => `n${n++}`)
    const all = [{ ...base, ...first.updated[0] }, ...first.created]
    const second = materializeRecurring(all, now, () => `m${n++}`)
    expect(second.created).toHaveLength(0)
    expect(all.filter((e) => e.recurrence)).toHaveLength(1)
  })

  it('does nothing before the next date', () => {
    const r = materializeRecurring([base], new Date(2026, 1, 1).getTime(), () => 'x')
    expect(r.created).toHaveLength(0)
  })

  it('repeats yearly', () => {
    const y: Expense = { ...base, date: new Date(2025, 4, 10).getTime(), recurrence: { every: 'year', anchorDay: 10 } }
    const r = materializeRecurring([y], new Date(2026, 5, 1).getTime(), () => 'y')
    expect(r.created).toHaveLength(1)
    expect(new Date(r.created[0].date).getFullYear()).toBe(2026)
  })

  it('does not duplicate an entry that already exists on the owed day', () => {
    const head: Expense = { ...base, id: 'h', date: new Date(2026, 0, 31).getTime() }
    const existing: Expense = { ...base, id: 'x', recurrence: undefined, date: new Date(2026, 1, 28, 9).getTime() }
    let n = 0
    const { created } = materializeRecurring([head, existing], new Date(2026, 2, 15).getTime(), () => `n${n++}`)
    expect(created).toHaveLength(0)
  })
})
