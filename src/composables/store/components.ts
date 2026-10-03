import * as db from '../../db/database'
import type { ComponentCheck, ComponentType } from '../../types'
import { computed } from 'vue'
import { car, componentChecks, makeId, nowTs } from './state'

export async function addComponentCheck(input: {
  type: ComponentType
  mileage?: number
  date?: number
  season?: 'summer' | 'winter' | 'allseason'
  treadDepthMm?: number
  pressureFront?: number
  pressureRear?: number
  thicknessMm?: number
  installedDate?: number
  note?: string
}): Promise<void> {
  if (!car.value) return
  const check: ComponentCheck = {
    id: makeId(),
    carId: car.value.id,
    type: input.type,
    mileage: input.mileage ?? car.value.currentMileage,
    date: input.date ?? nowTs(),
    season: input.season,
    treadDepthMm: input.treadDepthMm,
    pressureFront: input.pressureFront,
    pressureRear: input.pressureRear,
    thicknessMm: input.thicknessMm,
    installedDate: input.installedDate,
    note: input.note?.trim() || undefined,
  }
  componentChecks.unshift(check)
  await db.putComponentCheck(check)
}

export async function deleteComponentCheck(id: string): Promise<ComponentCheck | null> {
  const index = componentChecks.findIndex((c) => c.id === id)
  if (index === -1) return null
  const [removed] = componentChecks.splice(index, 1)
  await db.deleteComponentCheck(id)
  return removed
}

export async function restoreComponentCheck(check: ComponentCheck): Promise<void> {
  if (componentChecks.some((c) => c.id === check.id)) return
  componentChecks.push(check)
  await db.putComponentCheck(check)
}

/** Latest logged reading per component type, or null when none has ever been logged. */
export const latestComponentByType = computed<Record<ComponentType, ComponentCheck | null>>(() => {
  const result: Record<ComponentType, ComponentCheck | null> = { tires: null, battery: null, brakePads: null }
  for (const type of Object.keys(result) as ComponentType[]) {
    const matching = componentChecks.filter((c) => c.type === type).sort((a, b) => b.date - a.date)
    result[type] = matching[0] ?? null
  }
  return result
})

