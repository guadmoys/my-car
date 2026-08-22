import { computed, reactive, ref } from 'vue'
import type {
  BackupData,
  Car,
  FuelConsumption,
  FuelEntry,
  HistoryEntry,
  MaintenanceItem,
  MaintenanceStatus,
  Part,
} from '../types'
import { buildDefaultItems } from '../data/defaultMaintenance'
import * as db from '../db/database'

const car = ref<Car | null>(null)
const items = reactive<MaintenanceItem[]>([])
const fuelEntries = reactive<FuelEntry[]>([])
const historyEntries = reactive<HistoryEntry[]>([])
const isLoaded = ref(false)

function nowTs(): number {
  return Date.now()
}

function makeId(): string {
  return `custom-${nowTs()}-${Math.random().toString(36).slice(2, 8)}`
}

async function load(): Promise<void> {
  const [loadedCar, loadedItems, loadedFuel, loadedHistory] = await Promise.all([
    db.getCar(),
    db.getAllMaintenanceItems(),
    db.getAllFuelEntries(),
    db.getAllHistoryEntries(),
  ])
  car.value = loadedCar ?? null
  items.splice(0, items.length, ...loadedItems.map((item) => ({ ...item, parts: item.parts ?? [] })))
  fuelEntries.splice(0, fuelEntries.length, ...loadedFuel)
  historyEntries.splice(0, historyEntries.length, ...loadedHistory)
  isLoaded.value = true
}

async function createCar(input: {
  make: string
  model: string
  year: number
  initialMileage: number
}): Promise<void> {
  const newCar: Car = {
    id: 'main',
    make: input.make.trim(),
    model: input.model.trim(),
    year: input.year,
    initialMileage: input.initialMileage,
    currentMileage: input.initialMileage,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  }
  const defaults = buildDefaultItems(input.initialMileage)

  await db.putCar(newCar)
  await db.putMaintenanceItems(defaults)

  car.value = newCar
  items.splice(0, items.length, ...defaults)
}

async function updateCarInfo(
  patch: Partial<Pick<Car, 'make' | 'model' | 'year'>>,
): Promise<void> {
  if (!car.value) return
  const updated: Car = { ...car.value, ...patch, updatedAt: nowTs() }
  await db.putCar(updated)
  car.value = updated
}

async function updateMileage(newMileage: number): Promise<void> {
  if (!car.value) return
  const clamped = Math.max(newMileage, car.value.initialMileage)
  const updated: Car = { ...car.value, currentMileage: clamped, updatedAt: nowTs() }
  await db.putCar(updated)
  car.value = updated
}

async function toggleItem(id: string, enabled: boolean): Promise<void> {
  const item = items.find((i) => i.id === id)
  if (!item) return
  item.enabled = enabled
  await db.putMaintenanceItem({ ...item })
}

async function updateItem(
  id: string,
  patch: Partial<
    Pick<MaintenanceItem, 'name' | 'intervalKm' | 'intervalKmMax' | 'lastServiceMileage' | 'note' | 'parts'>
  >,
): Promise<void> {
  const item = items.find((i) => i.id === id)
  if (!item) return
  Object.assign(item, patch)
  await db.putMaintenanceItem({ ...item })
}

async function markServiced(id: string, atMileage?: number): Promise<void> {
  const item = items.find((i) => i.id === id)
  if (!item || !car.value) return
  const mileage = atMileage ?? car.value.currentMileage
  item.lastServiceMileage = mileage
  item.lastServiceDate = nowTs()
  await db.putMaintenanceItem({ ...item })

  const entry: HistoryEntry = {
    id: makeId(),
    itemId: item.id,
    itemName: item.name,
    mileage,
    date: nowTs(),
  }
  historyEntries.unshift(entry)
  await db.putHistoryEntry(entry)
}

async function addCustomItem(input: {
  name: string
  intervalKm: number
  intervalKmMax?: number
  parts?: Part[]
}): Promise<void> {
  if (!car.value) return
  const item: MaintenanceItem = {
    id: makeId(),
    name: input.name.trim(),
    intervalKm: input.intervalKm,
    intervalKmMax: input.intervalKmMax,
    enabled: true,
    lastServiceMileage: car.value.currentMileage,
    lastServiceDate: null,
    isCustom: true,
    order: items.length,
    parts: input.parts ?? [],
  }
  items.push(item)
  await db.putMaintenanceItem(item)
}

async function deleteItem(id: string): Promise<void> {
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) return
  items.splice(index, 1)
  await db.deleteMaintenanceItem(id)
}

async function addFuelEntry(input: { mileage: number; liters: number }): Promise<void> {
  if (!car.value) return
  const entry: FuelEntry = {
    id: makeId(),
    mileage: input.mileage,
    liters: input.liters,
    date: nowTs(),
  }
  fuelEntries.push(entry)
  await db.putFuelEntry(entry)

  if (input.mileage > car.value.currentMileage) {
    await updateMileage(input.mileage)
  }
}

async function deleteFuelEntry(id: string): Promise<void> {
  const index = fuelEntries.findIndex((e) => e.id === id)
  if (index === -1) return
  fuelEntries.splice(index, 1)
  await db.deleteFuelEntry(id)
}

function getItemHistory(itemId: string): HistoryEntry[] {
  return historyEntries
    .filter((h) => h.itemId === itemId)
    .slice()
    .sort((a, b) => b.date - a.date)
}

async function resetAll(): Promise<void> {
  await db.clearAll()
  car.value = null
  items.splice(0, items.length)
  fuelEntries.splice(0, fuelEntries.length)
  historyEntries.splice(0, historyEntries.length)
}

function exportData(): BackupData {
  return {
    version: 1,
    exportedAt: nowTs(),
    car: JSON.parse(JSON.stringify(car.value)),
    items: JSON.parse(JSON.stringify(items)),
    fuelEntries: JSON.parse(JSON.stringify(fuelEntries)),
    historyEntries: JSON.parse(JSON.stringify(historyEntries)),
  }
}

function isValidBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.car === 'object' &&
    d.car !== null &&
    typeof (d.car as Car).make === 'string' &&
    Array.isArray(d.items)
  )
}

async function importData(data: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidBackup(data)) {
    return { ok: false, error: 'Файл повреждён или это не резервная копия «Моей машины»' }
  }

  const importedCar = data.car
  const importedItems = data.items.map((item) => ({ ...item, parts: item.parts ?? [] }))
  const importedFuel = Array.isArray(data.fuelEntries) ? data.fuelEntries : []
  const importedHistory = Array.isArray(data.historyEntries) ? data.historyEntries : []

  await db.clearAll()
  await db.putCar(importedCar)
  await db.putMaintenanceItems(importedItems)
  if (importedFuel.length) await db.putFuelEntries(importedFuel)
  if (importedHistory.length) await db.putHistoryEntries(importedHistory)

  car.value = importedCar
  items.splice(0, items.length, ...importedItems)
  fuelEntries.splice(0, fuelEntries.length, ...importedFuel)
  historyEntries.splice(0, historyEntries.length, ...importedHistory)

  return { ok: true }
}

function statusFor(item: MaintenanceItem, currentMileage: number): MaintenanceStatus {
  const dueAtMileage = item.lastServiceMileage + item.intervalKm
  const remainingKm = dueAtMileage - currentMileage
  const traveled = currentMileage - item.lastServiceMileage
  const progress = Math.min(1, Math.max(0, traveled / item.intervalKm))

  let state: MaintenanceStatus['state'] = 'ok'
  if (remainingKm <= 0) {
    state = 'due'
  } else if (progress >= 0.9) {
    state = 'soon'
  }

  return { item, dueAtMileage, remainingKm, progress, state }
}

const statuses = computed<MaintenanceStatus[]>(() => {
  if (!car.value) return []
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => statusFor(item, car.value!.currentMileage))
})

const enabledStatuses = computed(() => statuses.value.filter((s) => s.item.enabled))
const disabledItems = computed(() =>
  items.filter((i) => !i.enabled).slice().sort((a, b) => a.order - b.order),
)

const dueCount = computed(
  () => enabledStatuses.value.filter((s) => s.state === 'due').length,
)
const soonCount = computed(
  () => enabledStatuses.value.filter((s) => s.state === 'soon').length,
)
const okCount = computed(
  () => enabledStatuses.value.filter((s) => s.state === 'ok').length,
)

const averageConsumption = computed<number | null>(() => {
  if (!car.value) return null
  const sorted = fuelEntries.slice().sort((a, b) => a.mileage - b.mileage)
  let totalLiters = 0
  let totalDistance = 0
  let previousMileage = car.value.initialMileage
  for (const entry of sorted) {
    const distance = entry.mileage - previousMileage
    if (distance > 0) {
      totalLiters += entry.liters
      totalDistance += distance
    }
    previousMileage = entry.mileage
  }
  return totalDistance > 0 ? (totalLiters / totalDistance) * 100 : null
})

const fuelHistory = computed<FuelConsumption[]>(() => {
  if (!car.value) return []
  const sorted = fuelEntries.slice().sort((a, b) => a.mileage - b.mileage)
  const avg = averageConsumption.value
  let previousMileage = car.value.initialMileage

  const result: FuelConsumption[] = sorted.map((entry) => {
    const distanceKm = entry.mileage - previousMileage
    previousMileage = entry.mileage
    const litersPer100km = distanceKm > 0 ? (entry.liters / distanceKm) * 100 : null

    let quality: FuelConsumption['quality'] = 'neutral'
    if (litersPer100km !== null && avg !== null) {
      quality = litersPer100km <= avg * 1.03 ? 'good' : 'bad'
    }

    return { entry, distanceKm, litersPer100km, quality }
  })

  return result.reverse()
})

export function useCarStore() {
  return {
    car,
    items,
    fuelEntries,
    historyEntries,
    isLoaded,
    statuses,
    enabledStatuses,
    disabledItems,
    dueCount,
    soonCount,
    okCount,
    fuelHistory,
    averageConsumption,
    load,
    createCar,
    updateCarInfo,
    updateMileage,
    toggleItem,
    updateItem,
    markServiced,
    addCustomItem,
    deleteItem,
    addFuelEntry,
    deleteFuelEntry,
    getItemHistory,
    resetAll,
    exportData,
    importData,
  }
}
