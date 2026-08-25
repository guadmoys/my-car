import { computed, reactive, ref } from 'vue'
import type {
  BackupData,
  Car,
  CostForecast,
  FuelConsumption,
  FuelEntry,
  FuelInsight,
  HistoryEntry,
  LegacyBackupData,
  MaintenanceItem,
  MaintenanceStatus,
  Part,
  TimelineEvent,
} from '../types'
import { buildDefaultItems } from '../data/defaultMaintenance'
import { adaptiveKmThreshold, adaptiveDayThreshold } from '../utils/adaptiveThreshold'
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
  patch: Partial<Pick<Car, 'make' | 'model' | 'year' | 'tankCapacity'>>,
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

async function markServiced(id: string, atMileage?: number): Promise<MarkServicedResult | null> {
  const item = items.find((i) => i.id === id)
  if (!item || !car.value) return null
  const previous = { lastServiceMileage: item.lastServiceMileage, lastServiceDate: item.lastServiceDate }
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

  return { historyEntryId: entry.id, previous }
}

async function undoMarkServiced(id: string, result: MarkServicedResult): Promise<void> {
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

async function addCustomItem(input: {
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
    enabled: true,
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

async function deleteItem(id: string): Promise<MaintenanceItem | null> {
  const index = items.findIndex((i) => i.id === id)
  if (index === -1) return null
  const [removed] = items.splice(index, 1)
  await db.deleteMaintenanceItem(id)
  return removed
}

async function restoreItem(item: MaintenanceItem): Promise<void> {
  if (items.some((i) => i.id === item.id)) return
  items.push(item)
  await db.putMaintenanceItem(item)
}

async function reorderDisabledItem(id: string, direction: 'up' | 'down'): Promise<void> {
  const disabled = items.filter((i) => !i.enabled).sort((a, b) => a.order - b.order)
  const idx = disabled.findIndex((i) => i.id === id)
  if (idx === -1) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= disabled.length) return
  const a = disabled[idx]
  const b = disabled[swapIdx]
  const aOrder = a.order
  a.order = b.order
  b.order = aOrder
  await Promise.all([db.putMaintenanceItem({ ...a }), db.putMaintenanceItem({ ...b })])
}

async function addFuelEntry(input: {
  mileage: number
  liters: number
  cost?: number
  fuelType?: string
  isFullTank?: boolean
  remainingLiters?: number
  station?: string
  comment?: string
}): Promise<void> {
  if (!car.value) return
  const entry: FuelEntry = {
    id: makeId(),
    carId: car.value.id,
    mileage: input.mileage,
    liters: input.liters,
    date: nowTs(),
    cost: input.cost,
    fuelType: input.fuelType,
    isFullTank: input.isFullTank,
    remainingLiters: input.remainingLiters,
    station: input.station,
    comment: input.comment,
  }
  fuelEntries.push(entry)
  await db.putFuelEntry(entry)

  if (input.mileage > car.value.currentMileage) {
    await updateMileage(input.mileage)
  }
}

async function deleteFuelEntry(id: string): Promise<FuelEntry | null> {
  const index = fuelEntries.findIndex((e) => e.id === id)
  if (index === -1) return null
  const [removed] = fuelEntries.splice(index, 1)
  await db.deleteFuelEntry(id)
  return removed
}

async function restoreFuelEntry(entry: FuelEntry): Promise<void> {
  if (fuelEntries.some((e) => e.id === entry.id)) return
  fuelEntries.push(entry)
  await db.putFuelEntry(entry)
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

/**
 * Average km driven per day, from the span of the fuel history. Guarded
 * against a short/burst date span the same way the budget forecast is, so
 * backfilling several fill-ups in one sitting doesn't produce a wild rate.
 */
const avgDailyKm = computed<number | null>(() => {
  if (fuelEntries.length < 2) return null
  const sorted = fuelEntries.slice().sort((a, b) => a.date - b.date)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const days = (last.date - first.date) / DAY_MS
  const distance = last.mileage - first.mileage
  if (days < 3 || distance <= 0) return null
  return distance / days
})

function statusFor(
  item: MaintenanceItem,
  currentMileage: number,
  now: number,
  dailyKm: number | null,
): MaintenanceStatus {
  const dueAtMileage = item.lastServiceMileage + item.intervalKm
  const remainingKm = dueAtMileage - currentMileage
  const traveled = currentMileage - item.lastServiceMileage
  const kmProgress = Math.min(1, Math.max(0, traveled / item.intervalKm))
  const itemHistory = historyEntries.filter((h) => h.itemId === item.id)
  const kmSoonThreshold = adaptiveKmThreshold(
    item.intervalKm,
    item.notifyBeforeKm,
    itemHistory.map((h) => h.mileage),
  ).value
  const kmState: MaintenanceStatus['state'] =
    remainingKm <= 0 ? 'due' : remainingKm <= kmSoonThreshold ? 'soon' : 'ok'

  let dueAtDate: number | undefined
  let remainingDays: number | undefined
  let dateState: MaintenanceStatus['state'] | null = null
  let dateProgress = 0

  if (item.intervalMonths && item.lastServiceDate) {
    dueAtDate = addMonths(item.lastServiceDate, item.intervalMonths)
    remainingDays = Math.ceil((dueAtDate - now) / DAY_MS)
    const totalSpan = dueAtDate - item.lastServiceDate
    dateProgress = totalSpan > 0 ? Math.min(1, Math.max(0, (now - item.lastServiceDate) / totalSpan)) : 1
    const daySoonThreshold = adaptiveDayThreshold(
      totalSpan,
      item.notifyBeforeDays,
      itemHistory.map((h) => h.date),
    ).value
    dateState = remainingDays <= 0 ? 'due' : remainingDays <= daySoonThreshold ? 'soon' : 'ok'
  }

  // Capped to a ~3-year horizon: beyond that, a daily-pace guess for a
  // long-interval item (e.g. a timing belt) is just noise, not a useful date.
  let estimatedDueDate: number | undefined
  if (dueAtDate === undefined && dailyKm !== null && dailyKm > 0 && remainingKm > 0) {
    const daysUntil = remainingKm / dailyKm
    if (daysUntil <= 1095) estimatedDueDate = now + daysUntil * DAY_MS
  }

  const state = dateState && stateRank(dateState) > stateRank(kmState) ? dateState : kmState
  const progress = dateState ? Math.max(kmProgress, dateProgress) : kmProgress

  return { item, dueAtMileage, remainingKm, dueAtDate, remainingDays, estimatedDueDate, progress, state }
}

const statuses = computed<MaintenanceStatus[]>(() => {
  if (!car.value) return []
  const now = Date.now()
  const dailyKm = avgDailyKm.value
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => statusFor(item, car.value!.currentMileage, now, dailyKm))
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

/**
 * A tank level expressed as `c + k * tankCapacity` liters, so a full-tank
 * reading stays exact even when the car's tank capacity isn't known: as
 * long as a segment both starts and ends on a full tank, the `k` terms
 * cancel out and the capacity is never actually needed.
 */
interface TankLevel {
  c: number
  k: number
}

function fuelLevels(entry: FuelEntry): { before: TankLevel; after: TankLevel } | null {
  const isFull = entry.isFullTank ?? true
  if (isFull) {
    return { before: { c: -entry.liters, k: 1 }, after: { c: 0, k: 1 } }
  }
  if (entry.remainingLiters !== undefined) {
    return {
      before: { c: entry.remainingLiters, k: 0 },
      after: { c: entry.remainingLiters + entry.liters, k: 0 },
    }
  }
  return null
}

function resolveLevel(level: TankLevel, tankCapacity: number | undefined): number | null {
  if (level.k === 0) return level.c
  return tankCapacity !== undefined ? level.c + level.k * tankCapacity : null
}

const consumptionAnalysis = computed<{
  history: FuelConsumption[]
  average: number | null
  currentLevelLiters: number | null
}>(() => {
  if (!car.value) return { history: [], average: null, currentLevelLiters: null }
  const capacity = car.value.tankCapacity
  const sorted = fuelEntries.slice().sort((a, b) => a.mileage - b.mileage)

  let anchorAfter: TankLevel = { c: 0, k: 1 }
  let anchorMileage = car.value.initialMileage
  let interimLiters = 0
  let previousMileage = car.value.initialMileage

  let totalBurned = 0
  let totalDistance = 0

  const rows = sorted.map((entry) => {
    const distanceKm = entry.mileage - previousMileage
    previousMileage = entry.mileage

    const levels = fuelLevels(entry)
    let litersPer100km: number | null = null

    if (levels) {
      const combined: TankLevel = {
        c: anchorAfter.c + interimLiters - levels.before.c,
        k: anchorAfter.k - levels.before.k,
      }
      const burned = resolveLevel(combined, capacity)
      const distance = entry.mileage - anchorMileage
      if (burned !== null && burned >= 0 && distance > 0) {
        litersPer100km = (burned / distance) * 100
        totalBurned += burned
        totalDistance += distance
      }
      anchorAfter = levels.after
      anchorMileage = entry.mileage
      interimLiters = 0
    } else {
      interimLiters += entry.liters
    }

    return { entry, distanceKm, litersPer100km }
  })

  const average = totalDistance > 0 ? (totalBurned / totalDistance) * 100 : null
  const currentLevelLiters = resolveLevel({ c: anchorAfter.c + interimLiters, k: anchorAfter.k }, capacity)

  const history: FuelConsumption[] = rows
    .map(({ entry, distanceKm, litersPer100km }) => {
      let quality: FuelConsumption['quality'] = 'neutral'
      if (litersPer100km !== null && average !== null) {
        quality = litersPer100km <= average * 1.03 ? 'good' : 'bad'
      }
      return { entry, distanceKm, litersPer100km, quality }
    })
    .reverse()

  return { history, average, currentLevelLiters }
})

const averageConsumption = computed<number | null>(() => consumptionAnalysis.value.average)
const fuelHistory = computed<FuelConsumption[]>(() => consumptionAnalysis.value.history)

/**
 * Estimated remaining range, when the current tank level is known (needs
 * either a full-tank fill-up or a tracked tank capacity) and there's an
 * average consumption to project it against.
 */
const estimatedRangeKm = computed<number | null>(() => {
  const currentLevel = consumptionAnalysis.value.currentLevelLiters
  const avg = averageConsumption.value
  if (currentLevel === null || currentLevel < 0 || avg === null || avg <= 0) return null
  return (currentLevel / avg) * 100
})

const averageFuelPrice = computed<number | null>(() => {
  const priced = fuelEntries.filter((e) => e.cost !== undefined && e.liters > 0)
  if (priced.length === 0) return null
  const totalCost = priced.reduce((sum, e) => sum + (e.cost as number), 0)
  const totalLiters = priced.reduce((sum, e) => sum + e.liters, 0)
  return totalCost / totalLiters
})

function co2FactorForFuelType(fuelType: string | undefined): number {
  if (fuelType?.includes('Дизель')) return 2.68
  if (fuelType?.includes('Газ')) return 1.51
  return 2.31 // gasoline (АИ-92/95/98), also the default when the grade wasn't recorded
}

const totalCo2Kg = computed<number>(() =>
  fuelEntries.reduce((sum, e) => sum + e.liters * co2FactorForFuelType(e.fuelType), 0),
)

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function daysWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

function fillupsWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'заправка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'заправки'
  return 'заправок'
}

const fuelInsights = computed<FuelInsight[]>(() => {
  if (!car.value) return []
  const insights: FuelInsight[] = []
  const history = fuelHistory.value
  const validSegments = history.filter((row) => row.litersPer100km !== null)
  const byDate = fuelEntries.slice().sort((a, b) => a.date - b.date)

  // Consumption trend: last 3 valid segments vs the 3 before them.
  if (validSegments.length >= 5) {
    const recent = validSegments.slice(0, 3).map((r) => r.litersPer100km as number)
    const prior = validSegments.slice(3, 6).map((r) => r.litersPer100km as number)
    if (prior.length >= 2) {
      const avgRecent = average(recent)
      const avgPrior = average(prior)
      const diffPct = ((avgRecent - avgPrior) / avgPrior) * 100
      if (diffPct <= -5) {
        insights.push({
          id: 'trend',
          icon: '📉',
          text: `Расход снижается: последние заправки в среднем на ${Math.abs(diffPct).toFixed(0)}% экономичнее, чем раньше`,
          tone: 'good',
        })
      } else if (diffPct >= 15) {
        insights.push({
          id: 'trend',
          icon: '⚠️',
          text: `Расход заметно вырос (+${diffPct.toFixed(0)}%) — стоит проверить давление в шинах, воздушный фильтр или стиль вождения`,
          tone: 'bad',
        })
      } else if (diffPct >= 5) {
        insights.push({
          id: 'trend',
          icon: '📈',
          text: `Расход растёт: последние заправки в среднем на ${diffPct.toFixed(0)}% больше, чем раньше`,
          tone: 'bad',
        })
      }
    }
  }

  // Anomaly detector: flags one fill-up whose л/100км is a statistical
  // outlier (z-score) against the rest, rather than a gradual drift like
  // the trend insight above. A high positive z-score is usually a data
  // entry slip (wrong mileage/liters) or a real mechanical issue; a sharply
  // negative one is almost always a typo, since consumption can't improve
  // that much between two fill-ups.
  if (validSegments.length >= 5) {
    const values = validSegments.map((r) => r.litersPer100km as number)
    const mean = average(values)
    const variance = average(values.map((v) => (v - mean) ** 2))
    const stddev = Math.sqrt(variance)
    if (stddev > 0) {
      const latest = validSegments[0].litersPer100km as number
      const z = (latest - mean) / stddev
      if (z >= 2) {
        insights.push({
          id: 'anomaly',
          icon: '🚨',
          text: `Последняя заправка сильно выбивается из общей картины: ${latest.toFixed(1)} л/100км против обычных ~${mean.toFixed(1)} — проверьте введённые данные или состояние авто (давление в шинах, утечки, форсунки)`,
          tone: 'bad',
        })
      } else if (z <= -2) {
        insights.push({
          id: 'anomaly',
          icon: '🧐',
          text: `Последняя заправка выглядит подозрительно экономичной: ${latest.toFixed(1)} л/100км против обычных ~${mean.toFixed(1)} — стоит перепроверить введённый пробег и литры`,
          tone: 'bad',
        })
      }
    }
  }

  // Efficiency streak: consecutive recent fill-ups better than average.
  let streak = 0
  for (const row of validSegments) {
    if (row.quality !== 'good') break
    streak++
  }
  if (streak >= 3) {
    insights.push({
      id: 'streak',
      icon: '🔥',
      text: `${streak} ${fillupsWord(streak)} подряд экономичнее среднего — отличная динамика!`,
      tone: 'good',
    })
  }

  // Estimated remaining range, when the current tank level is known
  // (needs either a full-tank fill-up or a tracked tank capacity), plus a
  // days-until-empty guess when there's enough driving history for a pace.
  const rangeKm = estimatedRangeKm.value
  if (rangeKm !== null) {
    const daily = avgDailyKm.value
    const daysUntilEmpty = daily !== null && daily > 0 ? rangeKm / daily : null
    const daysSuffix =
      daysUntilEmpty !== null ? ` (~${Math.round(daysUntilEmpty)} ${daysWord(Math.round(daysUntilEmpty))} при вашем темпе)` : ''
    if (rangeKm <= 60) {
      insights.push({
        id: 'range',
        icon: '⛽',
        text: `Топлива осталось примерно на ${Math.round(rangeKm)} км${daysSuffix} — скоро на заправку`,
        tone: 'bad',
      })
    } else {
      insights.push({
        id: 'range',
        icon: '🛣',
        text: `Ориентировочный запас хода: ~${Math.round(rangeKm)} км${daysSuffix}`,
        tone: 'neutral',
      })
    }
  }

  // Fuel budget forecast: rolling 30-day spend rate, projected forward.
  // Needs a real spread of dates — otherwise a batch of fill-ups entered
  // all at once (e.g. backfilling history) would wildly inflate the rate.
  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  const recentPriced = fuelEntries.filter((e) => e.date >= now - 30 * DAY_MS && e.cost !== undefined)
  if (recentPriced.length >= 2) {
    const earliestDate = Math.min(...recentPriced.map((e) => e.date))
    const daysSpan = (now - earliestDate) / DAY_MS
    if (daysSpan >= 3) {
      const totalSpent = recentPriced.reduce((sum, e) => sum + (e.cost as number), 0)
      const projected = (totalSpent / daysSpan) * 30
      insights.push({
        id: 'budget',
        icon: '📊',
        text: `За последние ${Math.round(daysSpan)} дн. на топливо потрачено ${Math.round(totalSpent).toLocaleString('ru-RU')} ₽ — при таком темпе выйдет ~${Math.round(projected).toLocaleString('ru-RU')} ₽ за 30 дней`,
        tone: 'neutral',
      })
    }
  }

  // Seasonal comparison: winter (Dec-Feb) vs summer (Jun-Aug) consumption.
  const winterVals = validSegments
    .filter((r) => [11, 0, 1].includes(new Date(r.entry.date).getMonth()))
    .map((r) => r.litersPer100km as number)
  const summerVals = validSegments
    .filter((r) => [5, 6, 7].includes(new Date(r.entry.date).getMonth()))
    .map((r) => r.litersPer100km as number)
  if (winterVals.length >= 2 && summerVals.length >= 2) {
    const winterAvg = average(winterVals)
    const summerAvg = average(summerVals)
    const diffPct = ((winterAvg - summerAvg) / summerAvg) * 100
    if (diffPct >= 8) {
      insights.push({
        id: 'seasonal',
        icon: '❄️',
        text: `Зимой расход в среднем на ${diffPct.toFixed(0)}% выше, чем летом (${winterAvg.toFixed(1)} против ${summerAvg.toFixed(1)} л/100км)`,
        tone: 'neutral',
      })
    }
  }

  // Price trend: latest fill vs the historical average price per liter.
  const priced = byDate
    .filter((e) => e.cost !== undefined && e.liters > 0)
    .map((e) => ({ entry: e, price: (e.cost as number) / e.liters }))
  if (priced.length >= 3) {
    const last = priced[priced.length - 1]
    const prevAvg = average(priced.slice(0, -1).map((p) => p.price))
    const diffPct = ((last.price - prevAvg) / prevAvg) * 100
    if (diffPct >= 7) {
      insights.push({
        id: 'price',
        icon: '💸',
        text: `Последняя заправка дороже обычного на ${diffPct.toFixed(0)}% (${last.price.toFixed(1)} ₽/л против ${prevAvg.toFixed(1)} ₽/л в среднем)`,
        tone: 'bad',
      })
    } else if (diffPct <= -7) {
      insights.push({
        id: 'price',
        icon: '💰',
        text: `Последняя заправка дешевле обычного на ${Math.abs(diffPct).toFixed(0)}% (${last.price.toFixed(1)} ₽/л против ${prevAvg.toFixed(1)} ₽/л в среднем)`,
        tone: 'good',
      })
    }
  }

  // Cheapest gas station, when at least two stations have price data.
  const stationGroups = new Map<string, { total: number; liters: number }>()
  for (const e of fuelEntries) {
    if (!e.station || e.cost === undefined || e.liters <= 0) continue
    const g = stationGroups.get(e.station) ?? { total: 0, liters: 0 }
    g.total += e.cost
    g.liters += e.liters
    stationGroups.set(e.station, g)
  }
  if (stationGroups.size >= 2) {
    const ranked = Array.from(stationGroups.entries())
      .map(([station, g]) => ({ station, avgPrice: g.total / g.liters }))
      .sort((a, b) => a.avgPrice - b.avgPrice)
    const best = ranked[0]
    const worst = ranked[ranked.length - 1]
    if (best.avgPrice <= worst.avgPrice * 0.97) {
      insights.push({
        id: 'station',
        icon: '📍',
        text: `Самая выгодная АЗС — «${best.station}»: в среднем ${best.avgPrice.toFixed(1)} ₽/л`,
        tone: 'good',
      })
    }
  }

  // Fuel grade comparison, when at least two grades have consumption data.
  const typeGroups = new Map<string, number[]>()
  for (const row of history) {
    if (row.litersPer100km === null || !row.entry.fuelType) continue
    const arr = typeGroups.get(row.entry.fuelType) ?? []
    arr.push(row.litersPer100km)
    typeGroups.set(row.entry.fuelType, arr)
  }
  const rankedTypes = Array.from(typeGroups.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([type, arr]) => ({ type, avg: average(arr) }))
    .sort((a, b) => a.avg - b.avg)
  if (rankedTypes.length >= 2) {
    const best = rankedTypes[0]
    const worst = rankedTypes[rankedTypes.length - 1]
    const diffPct = ((worst.avg - best.avg) / worst.avg) * 100
    if (diffPct >= 5) {
      insights.push({
        id: 'fuel-type',
        icon: '🔬',
        text: `На ${best.type} расход в среднем на ${diffPct.toFixed(0)}% ниже, чем на ${worst.type}`,
        tone: 'neutral',
      })
    }
  }

  // Fill-up frequency.
  if (byDate.length >= 3) {
    const gapsDays: number[] = []
    for (let i = 1; i < byDate.length; i++) {
      gapsDays.push((byDate[i].date - byDate[i - 1].date) / (24 * 60 * 60 * 1000))
    }
    const avgGapDays = Math.round(average(gapsDays))
    if (avgGapDays >= 1) {
      insights.push({
        id: 'frequency',
        icon: '🗓',
        text: `В среднем вы заправляетесь раз в ${avgGapDays} ${daysWord(avgGapDays)}`,
        tone: 'neutral',
      })
    }
  }

  // Cost per km driven, over the whole fuel-tracked mileage span.
  if (byDate.length >= 2) {
    const distance = byDate[byDate.length - 1].mileage - byDate[0].mileage
    const totalSpent = fuelEntries.reduce((sum, e) => sum + (e.cost ?? 0), 0)
    if (distance > 0 && totalSpent > 0) {
      insights.push({
        id: 'cost-per-km',
        icon: '🧮',
        text: `Топливо обходится примерно в ${(totalSpent / distance).toFixed(2)} ₽/км пробега`,
        tone: 'neutral',
      })
    }
  }

  return insights.slice(0, 6)
})

/**
 * Km driven since the start of the current calendar month, measured against
 * the most recent known mileage reading dated before this month (a fuel
 * entry, a completed service, or — failing either — the car's own creation
 * point). That fallback means a car added this month reports its full
 * mileage-to-date rather than an undefined gap.
 */
const monthDistanceKm = computed<number | null>(() => {
  if (!car.value) return null
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const points = [
    { mileage: car.value.initialMileage, date: car.value.createdAt },
    ...fuelEntries.map((e) => ({ mileage: e.mileage, date: e.date })),
    ...historyEntries.map((h) => ({ mileage: h.mileage, date: h.date })),
  ].sort((a, b) => a.date - b.date)

  const before = points.filter((p) => p.date < monthStart)
  const baseline = before.length > 0 ? before[before.length - 1] : points[0]
  return Math.max(0, car.value.currentMileage - baseline.mileage)
})

/** Fuel fill-ups and completed maintenance, merged into one date-sorted feed. */
const timelineEvents = computed<TimelineEvent[]>(() => {
  const fuel: TimelineEvent[] = fuelEntries.map((e) => ({
    kind: 'fuel',
    id: e.id,
    date: e.date,
    mileage: e.mileage,
    entry: e,
  }))
  const service: TimelineEvent[] = historyEntries.map((h) => ({
    kind: 'service',
    id: h.id,
    date: h.date,
    mileage: h.mileage,
    entry: h,
  }))
  return [...fuel, ...service].sort((a, b) => b.date - a.date)
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

const MONTH_DAYS = 30.44

/**
 * Expected number of times an enabled item will trigger within `days`.
 * Items with a month-based interval use that cadence directly; purely
 * km-based items need a driving-pace estimate (avgDailyKm) — without one,
 * they're left out rather than guessed at.
 */
function expectedServicesIn(days: number, dailyKm: number | null): number {
  let count = 0
  for (const item of items) {
    if (!item.enabled) continue
    if (item.intervalMonths) {
      count += days / (item.intervalMonths * MONTH_DAYS)
    } else if (dailyKm !== null && dailyKm > 0) {
      count += (dailyKm * days) / item.intervalKm
    }
  }
  return count
}

/**
 * Cost-of-ownership projection for 6 and 12 months out: a fuel-spend rate
 * (recent 90-day window, falling back to the full tracked history) times
 * the horizon, plus an expected maintenance cost — the average priced
 * service times how many services the enabled items are expected to
 * trigger in that horizon. A rough estimate by design (one flat average
 * service cost, not a per-item one), not a budgeting tool.
 */
const costForecast = computed<{ sixMonths: CostForecast | null; twelveMonths: CostForecast | null }>(() => {
  if (!car.value) return { sixMonths: null, twelveMonths: null }

  const priced = fuelEntries.filter((e) => e.cost !== undefined).sort((a, b) => a.date - b.date)
  if (priced.length < 2) return { sixMonths: null, twelveMonths: null }

  const now = Date.now()
  const recentWindow = priced.filter((e) => e.date >= now - 90 * DAY_MS)
  const windowEntries = recentWindow.length >= 2 ? recentWindow : priced
  const daysSpan = (now - windowEntries[0].date) / DAY_MS
  if (daysSpan < 3) return { sixMonths: null, twelveMonths: null }
  const dailyFuelRate =
    windowEntries.reduce((sum, e) => sum + (e.cost as number), 0) / daysSpan

  const pricedHistory = historyEntries.filter((h) => h.cost !== undefined)
  const avgServiceCost =
    pricedHistory.length > 0
      ? pricedHistory.reduce((sum, h) => sum + (h.cost as number), 0) / pricedHistory.length
      : 0

  function forecastFor(days: number): CostForecast {
    const fuel = dailyFuelRate * days
    const maintenance = expectedServicesIn(days, avgDailyKm.value) * avgServiceCost
    return { fuel, maintenance, total: fuel + maintenance }
  }

  return { sixMonths: forecastFor(6 * MONTH_DAYS), twelveMonths: forecastFor(12 * MONTH_DAYS) }
})

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
    monthDistanceKm,
    timelineEvents,
    estimatedRangeKm,
    averageFuelPrice,
    totalCo2Kg,
    fuelInsights,
    totalFuelCost,
    totalServiceCost,
    totalCost,
    hasAnyCost,
    costForecast,
    load,
    switchCar,
    createCar,
    deleteCar,
    updateCarInfo,
    updateMileage,
    toggleItem,
    updateItem,
    markServiced,
    undoMarkServiced,
    addCustomItem,
    deleteItem,
    restoreItem,
    reorderDisabledItem,
    addFuelEntry,
    deleteFuelEntry,
    restoreFuelEntry,
    updateFuelCost,
    updateHistoryCost,
    getItemHistory,
    exportData,
    importData,
  }
}
