import * as db from '../../db/database'
import type { Expense, ExpensePayload } from '../../types'
import { materializeRecurring } from '../../utils/recurring'
import { car, expenses, makeId, nowTs } from './state'

export function recurrenceFor(payload: Pick<ExpensePayload, 'repeat' | 'date'>): Expense['recurrence'] {
  return payload.repeat ? { every: payload.repeat, anchorDay: new Date(payload.date).getDate() } : undefined
}

export async function addExpense(input: Omit<ExpensePayload, 'date'> & { date?: number }): Promise<void> {
  if (!car.value) return
  const date = input.date ?? nowTs()
  const expense: Expense = {
    id: makeId(),
    carId: car.value.id,
    category: input.category,
    title: input.title?.trim() || undefined,
    amount: input.amount,
    date,
    note: input.note?.trim() || undefined,
    receiptPhoto: input.receiptPhoto,
    items: input.items?.length ? input.items : undefined,
    photos: input.photos?.length ? input.photos : undefined,
    masterId: input.masterId || undefined,
    itemId: input.itemId || undefined,
    recurrence: recurrenceFor({ repeat: input.repeat, date }),
  }
  expenses.unshift(expense)
  await db.putExpense(expense)
  // A series started in the past (or just now) may already owe entries.
  await applyRecurringExpenses()
}

export async function updateExpense(id: string, patch: ExpensePayload): Promise<void> {
  const expense = expenses.find((e) => e.id === id)
  if (!expense) return
  expense.category = patch.category
  expense.title = patch.title?.trim() || undefined
  expense.amount = patch.amount
  expense.date = patch.date
  expense.note = patch.note?.trim() || undefined
  expense.receiptPhoto = patch.receiptPhoto
  expense.items = patch.items?.length ? patch.items : undefined
  expense.photos = patch.photos?.length ? patch.photos : undefined
  expense.masterId = patch.masterId || undefined
  expense.itemId = patch.itemId || undefined
  expense.recurrence = recurrenceFor(patch)
  await db.putExpense({ ...expense })
  await applyRecurringExpenses()
}

// Serialises runs so a save and a car load can't both see the same head and
// each create the entries it owes.
let recurringQueue: Promise<unknown> = Promise.resolve()

/** Creates the entries that repeating expenses owe up to now (see utils/recurring.ts). */
export function applyRecurringExpenses(): Promise<number> {
  const run = async (): Promise<number> => {
    const { updated, created } = materializeRecurring(expenses, nowTs(), makeId)
    if (created.length === 0) return 0
    for (const head of updated) {
      const live = expenses.find((e) => e.id === head.id)
      if (live) live.recurrence = undefined
      await db.putExpense({ ...head })
    }
    for (const e of created) {
      expenses.unshift(e)
      await db.putExpense(e)
    }
    return created.length
  }
  const next = recurringQueue.then(run, run)
  recurringQueue = next.catch(() => undefined)
  return next
}

export async function deleteExpense(id: string): Promise<Expense | null> {
  const index = expenses.findIndex((e) => e.id === id)
  if (index === -1) return null
  const [removed] = expenses.splice(index, 1)
  await db.deleteExpense(id)
  return removed
}

export async function restoreExpense(expense: Expense): Promise<void> {
  if (expenses.some((e) => e.id === expense.id)) return
  expenses.push(expense)
  await db.putExpense(expense)
}

