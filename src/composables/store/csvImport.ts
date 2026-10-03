import * as db from '../../db/database'
import type { HistoryEntry } from '../../types'
import { composePartNote, composeServiceNote } from '../../utils/carCsvFormat'
import type { ParsedCarCsv } from '../../utils/carCsvFormat'
import { updateMileage } from './car'
import { addFuelEntry } from './fuel'
import { addCustomItem } from './maintenance'
import { car, fuelEntries, historyEntries, items, makeId } from './state'

export interface CsvImportSummary {
  fuelAdded: number
  fuelSkipped: number
  serviceAdded: number
  serviceSkipped: number
  partsAdded: number
  partsSkippedNoDate: number
}

/**
 * Additive import from the «Моя машина» (third-party app) CSV export: fuel
 * fill-ups are added as-is, while service/parts rows are matched to an
 * existing MaintenanceItem by name (or a new default one is created) so each
 * row can become a HistoryEntry the same way a normal "mark serviced" does.
 * Rows already present (same item + date + mileage, or same date + mileage
 * for fuel) are skipped so re-importing the same file is a no-op.
 */
export async function importCarCsv(parsed: ParsedCarCsv): Promise<CsvImportSummary> {
  const summary: CsvImportSummary = {
    fuelAdded: 0,
    fuelSkipped: 0,
    serviceAdded: 0,
    serviceSkipped: 0,
    partsAdded: 0,
    partsSkippedNoDate: parsed.skippedPartsCount,
  }
  if (!car.value) return summary

  const fuelSorted = parsed.fuel.slice().sort((a, b) => a.mileage - b.mileage)
  for (const row of fuelSorted) {
    if (fuelEntries.some((e) => e.date === row.date && e.mileage === row.mileage)) {
      summary.fuelSkipped++
      continue
    }
    await addFuelEntry({
      mileage: row.mileage,
      liters: row.liters,
      date: row.date,
      cost: row.cost,
      fuelType: row.fuelType,
      isFullTank: row.isFullTank,
      station: row.station,
      comment: row.comment,
    })
    summary.fuelAdded++
  }

  async function importServiceEvent(
    name: string,
    date: number,
    mileage: number,
    cost: number | undefined,
    note: string | undefined,
  ): Promise<boolean> {
    const normalized = name.trim().toLowerCase()
    let item = items.find((i) => i.name.trim().toLowerCase() === normalized)
    if (!item) {
      await addCustomItem({ name, intervalKm: 10000, intervalMonths: 12 })
      item = items.find((i) => i.name.trim().toLowerCase() === normalized)
    }
    if (!item || !car.value) return false
    const carId = car.value.id

    if (historyEntries.some((h) => h.itemId === item!.id && h.date === date && h.mileage === mileage)) return false

    const entry: HistoryEntry = {
      id: makeId(),
      carId,
      itemId: item.id,
      itemName: item.name,
      mileage,
      date,
      cost,
      note,
    }
    historyEntries.push(entry)
    await db.putHistoryEntry(entry)

    if (mileage >= item.lastServiceMileage) {
      item.lastServiceMileage = mileage
      item.lastServiceDate = date
      await db.putMaintenanceItem({ ...item })
    }
    if (car.value?.id === carId && mileage > car.value.currentMileage) {
      await updateMileage(mileage, date)
    }
    return true
  }

  const serviceSorted = parsed.service.slice().sort((a, b) => a.mileage - b.mileage)
  for (const row of serviceSorted) {
    const added = await importServiceEvent(row.name, row.date, row.mileage, row.cost, composeServiceNote(row))
    if (added) summary.serviceAdded++
    else summary.serviceSkipped++
  }

  const partsSorted = parsed.parts.slice().sort((a, b) => a.mileage - b.mileage)
  for (const row of partsSorted) {
    const added = await importServiceEvent(row.name, row.date, row.mileage, row.cost, composePartNote(row))
    if (added) summary.partsAdded++
  }

  return summary
}

