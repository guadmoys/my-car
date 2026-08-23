export interface Car {
  id: string
  make: string
  model: string
  year: number
  initialMileage: number
  currentMileage: number
  createdAt: number
  updatedAt: number
}

export interface Part {
  id: string
  name: string
  articleNumber: string
  platform: string
  /** Optional direct link to buy this part. */
  url?: string
}

export interface MaintenanceItem {
  id: string
  carId: string
  name: string
  /** Interval in km used for progress calculations (the lower bound when a range is given). */
  intervalKm: number
  /** Upper bound of the interval, when the manufacturer gives a range instead of a single value. */
  intervalKmMax?: number
  /** Optional time-based interval in months, checked alongside the km interval ("whichever comes first"). */
  intervalMonths?: number
  enabled: boolean
  /** Odometer reading at which this item was last serviced. */
  lastServiceMileage: number
  lastServiceDate: number | null
  isCustom: boolean
  order: number
  note?: string
  parts: Part[]
  /** Override for how many km before the due mileage this item becomes "soon" (and notifies). Defaults to 10% of the interval. */
  notifyBeforeKm?: number
  /** Override for how many days before the due date this item becomes "soon" (and notifies). Only relevant when intervalMonths is set; defaults to 10% of the interval span. */
  notifyBeforeDays?: number
}

export interface MaintenanceStatus {
  item: MaintenanceItem
  dueAtMileage: number
  remainingKm: number
  /** Set only when the item has a time-based interval. */
  dueAtDate?: number
  remainingDays?: number
  progress: number
  state: 'ok' | 'soon' | 'due'
}

export interface HistoryEntry {
  id: string
  carId: string
  itemId: string
  /** Name of the maintenance item at the time it was completed (item may later be renamed or deleted). */
  itemName: string
  mileage: number
  date: number
  /** Cost of this service (parts + labor), in the user's currency. Optional. */
  cost?: number
}

export interface FuelEntry {
  id: string
  carId: string
  /** Odometer reading at the time of this fill-up. */
  mileage: number
  liters: number
  date: number
  /** Total cost of this fill-up. Optional. */
  cost?: number
}

export interface FuelConsumption {
  entry: FuelEntry
  distanceKm: number
  litersPer100km: number | null
  quality: 'good' | 'bad' | 'neutral'
}

export interface BackupData {
  version: 2
  exportedAt: number
  cars: Car[]
  activeCarId: string | null
  items: MaintenanceItem[]
  fuelEntries: FuelEntry[]
  historyEntries: HistoryEntry[]
}

/** Shape of a v1 backup (single car, no carId fields), kept only for import compatibility. */
export interface LegacyBackupData {
  version: 1
  exportedAt: number
  car: Car
  items: Omit<MaintenanceItem, 'carId'>[]
  fuelEntries: Omit<FuelEntry, 'carId'>[]
  historyEntries: Omit<HistoryEntry, 'carId'>[]
}
