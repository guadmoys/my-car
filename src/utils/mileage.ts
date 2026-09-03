import type { Car, FuelEntry, HistoryEntry } from '../types'

// Trims the last 3 digits off the current mileage so a new-odometer-reading
// input can start pre-filled with just the higher-order digits — the user
// only needs to type the missing low digits instead of erasing the whole
// value first. Below 1000 km there's nothing meaningful left to seed with,
// so the field starts blank.
export function mileageInputSeed(currentMileage: number): string {
  return currentMileage >= 1000 ? String(Math.floor(currentMileage / 1000)) : ''
}

export interface MileagePoint {
  mileage: number
  date: number
}

/**
 * Every mileage fact this app actually trusts for a car, besides the reading
 * being entered right now: the odometer value it started at, plus every fuel
 * fill-up and completed service (both carry a fixed mileage+date). The car's
 * own `currentMileage`/`updatedAt` is included only when `asOf` is at or
 * after `updatedAt` — i.e. only while the new reading would still be the
 * newest thing on record. Once the chosen date predates the last update,
 * that current reading is the very value being corrected, not a fact to
 * validate against, so it's deliberately left out (only the fuel/service
 * anchors — real, immutable receipts — still constrain a backdated entry).
 */
export function mileageAnchors(
  car: Car,
  fuelEntries: FuelEntry[],
  historyEntries: HistoryEntry[],
  asOf: number,
): MileagePoint[] {
  const points: MileagePoint[] = [
    { mileage: car.initialMileage, date: car.createdAt },
    ...fuelEntries.map((e) => ({ mileage: e.mileage, date: e.date })),
    ...historyEntries.map((h) => ({ mileage: h.mileage, date: h.date })),
  ]
  if (asOf >= car.updatedAt) points.push({ mileage: car.currentMileage, date: car.updatedAt })
  return points
}

export interface MileageRange {
  /** Highest mileage already on record at or before the target date — a new reading below this implies the odometer went backwards. */
  min: number
  /** The date that produced `min`, or null when nothing anchors it (min is just 0). */
  minAt: number | null
  /** Lowest mileage already on record strictly after the target date — a new reading above this implies a later record's mileage went backwards instead. */
  max: number | null
  /** The date that produced `max`, or null when there's no later anchor. */
  maxAt: number | null
}

/** The plausible [min, max] range for a reading taken at `date`, derived from every other known mileage anchor. */
export function plausibleMileageRange(anchors: MileagePoint[], date: number): MileageRange {
  let min = 0
  let minAt: number | null = null
  let max: number | null = null
  let maxAt: number | null = null
  for (const p of anchors) {
    if (p.date <= date) {
      if (minAt === null || p.mileage > min) {
        min = p.mileage
        minAt = p.date
      }
    } else if (max === null || p.mileage < max) {
      max = p.mileage
      maxAt = p.date
    }
  }
  return { min, minAt, max, maxAt }
}
