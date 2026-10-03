import * as db from '../../db/database'
import type { ExpenseItem, HistoryEntry, MaintenanceItem, Part } from '../../types'
import { car, historyEntries, items, makeId, nowTs } from './state'

export async function updateItem(
  id: string,
  patch: Partial<
    Pick<
      MaintenanceItem,
      | 'name'
      | 'intervalKm'
      | 'intervalKmMax'
      | 'intervalMonths'
      | 'lastServiceMileage'
      | 'note'
      | 'parts'
      | 'notifyBeforeKm'
      | 'notifyBeforeDays'
    >
  >,
): Promise<void> {
  const item = items.find((i) => i.id === id)
  if (!item) return
  Object.assign(item, patch)
  await db.putMaintenanceItem({ ...item })
}

export interface MarkServicedResult {
  historyEntryId: string
  previous: { lastServiceMileage: number; lastServiceDate: number | null }
}

export async function markServiced(
  id: string,
  atMileage?: number,
  cost?: number,
  receiptPhoto?: string,
  date?: number,
  breakdown?: ExpenseItem[],
  masterId?: string,
): Promise<MarkServicedResult | null> {
  const item = items.find((i) => i.id === id)
  if (!item || !car.value) return null
  const previous = { lastServiceMileage: item.lastServiceMileage, lastServiceDate: item.lastServiceDate }
  const mileage = atMileage ?? car.value.currentMileage
  const serviceDate = date ?? nowTs()

  const entry: HistoryEntry = {
    id: makeId(),
    carId: car.value.id,
    itemId: item.id,
    itemName: item.name,
    mileage,
    date: serviceDate,
    cost,
    receiptPhoto,
    items: breakdown?.length ? breakdown : undefined,
    masterId: masterId || undefined,
  }

  item.lastServiceMileage = mileage
  item.lastServiceDate = serviceDate
  historyEntries.unshift(entry)

  try {
    await db.putMaintenanceItem({ ...item })
    await db.putHistoryEntry(entry)
  } catch (e) {
    // Roll back the optimistic in-memory changes so a failed write can't
    // leave the item looking "serviced" with no matching history record.
    item.lastServiceMileage = previous.lastServiceMileage
    item.lastServiceDate = previous.lastServiceDate
    const idx = historyEntries.findIndex((h) => h.id === entry.id)
    if (idx !== -1) historyEntries.splice(idx, 1)
    throw e
  }

  return { historyEntryId: entry.id, previous }
}

export async function undoMarkServiced(id: string, result: MarkServicedResult): Promise<void> {
  const item = items.find((i) => i.id === id)
  if (item) {
    item.lastServiceMileage = result.previous.lastServiceMileage
    item.lastServiceDate = result.previous.lastServiceDate
    await db.putMaintenanceItem({ ...item })
  }
  const idx = historyEntries.findIndex((h) => h.id === result.historyEntryId)
  if (idx !== -1) historyEntries.splice(idx, 1)
  await db.deleteHistoryEntry(result.historyEntryId)
}

export async function addCustomItem(input: {
  name: string
  intervalKm: number
  intervalKmMax?: number
  intervalMonths?: number
  parts?: Part[]
  notifyBeforeKm?: number
  notifyBeforeDays?: number
}): Promise<void> {
  if (!car.value) return
  const item: MaintenanceItem = {
    id: makeId(),
    carId: car.value.id,
    name: input.name.trim(),
    intervalKm: input.intervalKm,
    intervalKmMax: input.intervalKmMax,
    intervalMonths: input.intervalMonths,
    lastServiceMileage: car.value.currentMileage,
    lastServiceDate: nowTs(),
    isCustom: true,
    order: items.length,
    parts: input.parts ?? [],
    notifyBeforeKm: input.notifyBeforeKm,
    notifyBeforeDays: input.notifyBeforeDays,
  }
  items.push(item)
  await db.putMaintenanceItem(item)
}

export async function deleteItem(id: string): Promise<MaintenanceItem | null> {
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) return null
  const [removed] = items.splice(index, 1)
  await db.deleteMaintenanceItem(id)
  return removed
}

export async function restoreItem(item: MaintenanceItem): Promise<void> {
  if (items.some((i) => i.id === item.id)) return
  items.push(item)
  await db.putMaintenanceItem(item)
}

export async function updateHistoryEntry(
  id: string,
  input: { itemName: string; mileage: number; date: number; cost?: number; receiptPhoto?: string; note?: string; items?: ExpenseItem[]; masterId?: string },
): Promise<void> {
  const entry = historyEntries.find((h) => h.id === id)
  if (!entry) return
  entry.itemName = input.itemName
  entry.mileage = input.mileage
  entry.date = input.date
  entry.cost = input.cost ?? undefined
  entry.receiptPhoto = input.receiptPhoto
  entry.note = input.note?.trim() || undefined
  entry.items = input.items?.length ? input.items : undefined
  entry.masterId = input.masterId || undefined
  await db.putHistoryEntry({ ...entry })
}

export function getItemHistory(itemId: string): HistoryEntry[] {
  return historyEntries
    .filter((h) => h.itemId === itemId)
    .slice()
    .sort((a, b) => b.date - a.date)
}

