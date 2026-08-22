import { computed, reactive, ref } from 'vue'
import type {
  BackupData,
  Car,
  FuelConsumption,
  FuelEntry,
  HistoryEntry,
  LegacyBackupData,
  MaintenanceItem,
  MaintenanceStatus,
  Part,
} from '../types'
import { buildDefaultItems } from '../data/defaultMaintenance'
import * as db from '../db/database'

const ACTIVE_CAR_KEY = 'my-car-active-car-id'

const cars = reactive<Car[]>([])
const activeCarId = ref<string | null>(null)
const items = reactive<MaintenanceItem[]>([])
const fuelEntries = reactive<FuelEntry[]>([])
const historyEntries = reactive<HistoryEntry[]>([])
const isLoaded = ref(false)

const car = computed(() => cars.find((c) => c.id === activeCarId.value) ?? null)

function nowTs(): number {
  return Date.now()
}

function makeId(): string {
  return `id-${nowTs()}-${Math.random().toString(36).slice(2, 8)}`
}

function patchCar(carId: string, patch: Partial<Car>): Car | null {
  const idx = cars.findIndex((c) => c.id === carId)
  if (idx === -1) return null
  const updated: Car = { ...cars[idx], ...patch, updatedAt: nowTs() }
  cars[idx] = updated
  return updated
}

async function loadCarData(carId: string): Promise<void> {
  const [loadedItems, loadedFuel, loadedHistory] = await Promise.all([
    db.getMaintenanceItemsForCar(carId),
    db.getFuelEntriesForCar(carId),
    db.getHistoryForCar(carId),
  ])
  items.splice(0, items.length, ...loadedItems.map((item) => ({ ...item, parts: item.parts ?? [] })))
  fuelEntries.splice(0, fuelEntries.length, ...loadedFuel)
  historyEntries.splice(0, historyEntries.length, ...loadedHistory)
}

async function load(): Promise<void> {
  const loadedCars = await db.getAllCars()
  cars.splice(0, cars.length, ...loadedCars)

  if (cars.length > 0) {
    const stored = localStorage.getItem(ACTIVE_CAR_KEY)
    const validStored = stored && cars.some((c) => c.id === stored) ? stored : null
    const nextActiveId = validStored ?? cars[0].id
    activeCarId.value = nextActiveId
    localStorage.setItem(ACTIVE_CAR_KEY, nextActiveId)
    await loadCarData(nextActiveId)
  }

  isLoaded.value = true
}

async function switchCar(carId: string): Promise<void> {
  if (carId === activeCarId.value) return
  if (!cars.some((c) => c.id === carId)) return
  activeCarId.value = carId
  localStorage.setItem(ACTIVE_CAR_KEY, carId)
  await loadCarData(carId)
}

async function createCar(input: {
  make: string
  model: string
  year: number
  initialMileage: number
}): Promise<void> {
  const newCar: Car = {
    id: makeId(),
    make: input.make.trim(),
    model: input.model.trim(),
    year: input.year,
    initialMileage: input.initialMileage,
    currentMileage: input.initialMileage,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  }
  const defaults = buildDefaultItems(input.initialMileage, newCar.id)

  await db.putCar(newCar)
  await db.putMaintenanceItems(defaults)

  cars.push(newCar)
  activeCarId.value = newCar.id
  localStorage.setItem(ACTIVE_CAR_KEY, newCar.id)
  items.splice(0, items.length, ...defaults)
  fuelEntries.splice(0, fuelEntries.length)
  historyEntries.splice(0, historyEntries.length)
}

async function deleteCar(carId: string): Promise<void> {
  await db.deleteCarCascade(carId)
  const idx = cars.findIndex((c) => c.id === carId)
  if (idx !== -1) cars.splice(idx, 1)

  if (activeCarId.value !== carId) return

  const next = cars[0] ?? null
  if (next) {
    activeCarId.value = next.id
    localStorage.setItem(ACTIVE_CAR_KEY, next.id)
    await loadCarData(next.id)
  } else {
    activeCarId.value = null
    localStorage.removeItem(ACTIVE_CAR_KEY)
    items.splice(0, items.length)
    fuelEntries.splice(0, fuelEntries.length)
    historyEntries.splice(0, historyEntries.length)
  }
}

async function updateCarInfo(
  patch: Partial<Pick<Car, 'make' | 'model' | 'year'>>,
): Promise<void> {
  if (!activeCarId.value) return
  const updated = patchCar(activeCarId.value, patch)
  if (updated) await db.putCar(updated)
}

async function updateMileage(newMileage: number): Promise<void> {
  if (!car.value) return
  const clamped = Math.max(newMileage, car.value.initialMileage)
  const updated = patchCar(car.value.id, { currentMileage: clamped })
  if (updated) await db.putCar(updated)
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
    Pick<
      MaintenanceItem,
      'name' | 'intervalKm' | 'intervalKmMax' | 'intervalMonths' | 'lastServiceMileage' | 'note' | 'parts'
    >
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
    carId: car.value.id,
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
  intervalMonths?: number
  parts?: Part[]
}): Promise<void> {
  if (!car.value) return
  const item: MaintenanceItem = {
    id: makeId(),
    carId: car.value.id,
    name: input.name.trim(),
    intervalKm: input.intervalKm,
    intervalKmMax: input.intervalKmMax,
    intervalMonths: input.intervalMonths,
    enabled: true,
    lastServiceMileage: car.value.currentMileage,
    lastServiceDate: nowTs(),
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

async function addFuelEntry(input: { mileage: number; liters: number; cost?: number }): Promise<void> {
  if (!car.value) return
  const entry: FuelEntry = {
    id: makeId(),
    carId: car.value.id,
    mileage: input.mileage,
    liters: input.liters,
    date: nowTs(),
    cost: input.cost,
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

async function updateFuelCost(id: string, cost: number | null): Promise<void> {
  const entry = fuelEntries.find((e) => e.id === id)
  if (!entry) return
  entry.cost = cost ?? undefined
  await db.putFuelEntry({ ...entry })
}

async function updateHistoryCost(id: string, cost: number | null): Promise<void> {
  const entry = historyEntries.find((h) => h.id === id)
  if (!entry) return
  entry.cost = cost ?? undefined
  await db.putHistoryEntry({ ...entry })
}

function getItemHistory(itemId: string): HistoryEntry[] {
  return historyEntries
    .filter((h) => h.itemId === itemId)
    .slice()
    .sort((a, b) => b.date - a.date)
}

function addMonths(ts: number, months: number): number {
  const d = new Date(ts)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

function stateRank(state: MaintenanceStatus['state']): number {
  return state === 'due' ? 2 : state === 'soon' ? 1 : 0
}

const DAY_MS = 24 * 60 * 60 * 1000

function statusFor(item: MaintenanceItem, currentMileage: number, now: number): MaintenanceStatus {
  const dueAtMileage = item.lastServiceMileage + item.intervalKm
  const remainingKm = dueAtMileage - currentMileage
  const traveled = currentMileage - item.lastServiceMileage
  const kmProgress = Math.min(1, Math.max(0, traveled / item.intervalKm))
  const kmState: MaintenanceStatus['state'] = remainingKm <= 0 ? 'due' : kmProgress >= 0.9 ? 'soon' : 'ok'

  let dueAtDate: number | undefined
  let remainingDays: number | undefined
  let dateState: MaintenanceStatus['state'] | null = null
  let dateProgress = 0

  if (item.intervalMonths && item.lastServiceDate) {
    dueAtDate = addMonths(item.lastServiceDate, item.intervalMonths)
    remainingDays = Math.ceil((dueAtDate - now) / DAY_MS)
    const totalSpan = dueAtDate - item.lastServiceDate
    dateProgress = totalSpan > 0 ? Math.min(1, Math.max(0, (now - item.lastServiceDate) / totalSpan)) : 1
    dateState = remainingDays <= 0 ? 'due' : dateProgress >= 0.9 ? 'soon' : 'ok'
  }

  const state = dateState && stateRank(dateState) > stateRank(kmState) ? dateState : kmState
  const progress = dateState ? Math.max(kmProgress, dateProgress) : kmProgress

  return { item, dueAtMileage, remainingKm, dueAtDate, remainingDays, progress, state }
}

const statuses = computed<MaintenanceStatus[]>(() => {
  if (!car.value) return []
  const now = Date.now()
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => statusFor(item, car.value!.currentMileage, now))
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

const totalFuelCost = computed(() =>
  fuelEntries.reduce((sum, e) => sum + (e.cost ?? 0), 0),
)
const totalServiceCost = computed(() =>
  historyEntries.reduce((sum, h) => sum + (h.cost ?? 0), 0),
)
const totalCost = computed(() => totalFuelCost.value + totalServiceCost.value)
const hasAnyCost = computed(
  () => fuelEntries.some((e) => e.cost !== undefined) || historyEntries.some((h) => h.cost !== undefined),
)

function isMultiCarBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return Array.isArray(d.cars) && Array.isArray(d.items)
}

function isLegacyBackup(data: unknown): data is LegacyBackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return typeof d.car === 'object' && d.car !== null && Array.isArray(d.items)
}

async function exportData(): Promise<BackupData> {
  const [allCars, allItems, allFuel, allHistory] = await Promise.all([
    db.getAllCars(),
    db.getAllMaintenanceItemsRaw(),
    db.getAllFuelEntriesRaw(),
    db.getAllHistoryRaw(),
  ])
  return {
    version: 2,
    exportedAt: nowTs(),
    cars: allCars,
    activeCarId: activeCarId.value,
    items: allItems,
    fuelEntries: allFuel,
    historyEntries: allHistory,
  }
}

async function importData(data: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  let importedCars: Car[]
  let importedItems: MaintenanceItem[]
  let importedFuel: FuelEntry[]
  let importedHistory: HistoryEntry[]
  let newActiveCarId: string | undefined

  if (isMultiCarBackup(data)) {
    importedCars = data.cars
    importedItems = data.items.map((i) => ({ ...i, parts: i.parts ?? [] }))
    importedFuel = Array.isArray(data.fuelEntries) ? data.fuelEntries : []
    importedHistory = Array.isArray(data.historyEntries) ? data.historyEntries : []
    newActiveCarId =
      data.activeCarId && importedCars.some((c) => c.id === data.activeCarId)
        ? data.activeCarId
        : importedCars[0]?.id
  } else if (isLegacyBackup(data)) {
    const carId = data.car.id && data.car.id !== 'main' ? data.car.id : makeId()
    importedCars = [{ ...data.car, id: carId }]
    importedItems = data.items.map((i) => ({ ...i, carId, parts: i.parts ?? [] }))
    importedFuel = (data.fuelEntries ?? []).map((f) => ({ ...f, carId }))
    importedHistory = (data.historyEntries ?? []).map((h) => ({ ...h, carId }))
    newActiveCarId = carId
  } else {
    return { ok: false, error: 'Файл повреждён или это не резервная копия «Моей машины»' }
  }

  if (!newActiveCarId || importedCars.length === 0) {
    return { ok: false, error: 'В файле нет ни одной машины' }
  }

  await db.clearAll()
  await db.putCars(importedCars)
  await db.putMaintenanceItems(importedItems)
  if (importedFuel.length) await db.putFuelEntries(importedFuel)
  if (importedHistory.length) await db.putHistoryEntries(importedHistory)

  cars.splice(0, cars.length, ...importedCars)
  activeCarId.value = newActiveCarId
  localStorage.setItem(ACTIVE_CAR_KEY, newActiveCarId)

  items.splice(0, items.length, ...importedItems.filter((i) => i.carId === newActiveCarId))
  fuelEntries.splice(0, fuelEntries.length, ...importedFuel.filter((f) => f.carId === newActiveCarId))
  historyEntries.splice(
    0,
    historyEntries.length,
    ...importedHistory.filter((h) => h.carId === newActiveCarId),
  )

  return { ok: true }
}

export function useCarStore() {
  return {
    cars,
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
    totalFuelCost,
    totalServiceCost,
    totalCost,
    hasAnyCost,
    load,
    switchCar,
    createCar,
    deleteCar,
    updateCarInfo,
    updateMileage,
    toggleItem,
    updateItem,
    markServiced,
    addCustomItem,
    deleteItem,
    addFuelEntry,
    deleteFuelEntry,
    updateFuelCost,
    updateHistoryCost,
    getItemHistory,
    exportData,
    importData,
  }
}
