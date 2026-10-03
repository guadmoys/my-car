import * as db from '../../db/database'
import type { Reminder } from '../../types'
import { car, makeId, nowTs, reminders } from './state'

export async function addReminder(input: { text: string; dueMileage?: number; dueDate?: number; hasTime?: boolean }): Promise<void> {
  if (!car.value) return
  const reminder: Reminder = {
    id: makeId(),
    carId: car.value.id,
    text: input.text.trim(),
    createdAt: nowTs(),
    dueMileage: input.dueMileage,
    dueDate: input.dueDate,
    hasTime: input.hasTime,
  }
  reminders.push(reminder)
  await db.putReminder(reminder)
}

export async function deleteReminder(id: string): Promise<Reminder | null> {
  const index = reminders.findIndex((r) => r.id === id)
  if (index === -1) return null
  const [removed] = reminders.splice(index, 1)
  await db.deleteReminder(id)
  return removed
}

export async function restoreReminder(reminder: Reminder): Promise<void> {
  if (reminders.some((r) => r.id === reminder.id)) return
  reminders.push(reminder)
  await db.putReminder(reminder)
}

