import type {
  Car,
  CarDocument,
  ComponentCheck,
  Expense,
  FuelEntry,
  HistoryEntry,
  MaintenanceItem,
  Master,
  Reminder,
  Trip,
} from '../../types'
import { computed, reactive, ref } from 'vue'

export const ACTIVE_CAR_KEY = 'my-car-active-car-id'

export const cars = reactive<Car[]>([])

export const activeCarId = ref<string | null>(null)

export const items = reactive<MaintenanceItem[]>([])

export const fuelEntries = reactive<FuelEntry[]>([])

export const historyEntries = reactive<HistoryEntry[]>([])

export const reminders = reactive<Reminder[]>([])

export const masters = reactive<Master[]>([])

export const expenses = reactive<Expense[]>([])

export const componentChecks = reactive<ComponentCheck[]>([])

export const trips = reactive<Trip[]>([])

export const documents = reactive<CarDocument[]>([])

export const isLoaded = ref(false)

/** True while importData/restoreFromCloud is replacing the whole database — lets useCloudSync suppress auto-sync so it can't export a partially-imported state over the cloud backup. */
export const isImporting = ref(false)

export const car = computed(() => cars.find((c) => c.id === activeCarId.value) ?? null)

export function nowTs(): number {
  return Date.now()
}

export function makeId(): string {
  return `id-${nowTs()}-${Math.random().toString(36).slice(2, 8)}`
}

export function patchCar(carId: string, patch: Partial<Car>): Car | null {
  const idx = cars.findIndex((c) => c.id === carId)
  if (idx === -1) return null
  const updated: Car = { ...cars[idx], ...patch, updatedAt: patch.updatedAt ?? nowTs() }
  cars[idx] = updated
  return updated
}

// Each loadCarData call takes a ticket; only the latest one may apply its results, so a slow, stale
// fetch can never clobber a newer state with the wrong car's data.
let loadCarDataToken = 0

export function bumpLoadToken(): number {
  return ++loadCarDataToken
}

export function currentLoadToken(): number {
  return loadCarDataToken
}

