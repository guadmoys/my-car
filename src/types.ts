export interface Car {
  id: 'main'
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
  name: string
  /** Interval in km used for progress calculations (the lower bound when a range is given). */
  intervalKm: number
  /** Upper bound of the interval, when the manufacturer gives a range instead of a single value. */
  intervalKmMax?: number
  enabled: boolean
  /** Odometer reading at which this item was last serviced. */
  lastServiceMileage: number
  lastServiceDate: number | null
  isCustom: boolean
  order: number
  note?: string
  parts: Part[]
}

export interface MaintenanceStatus {
  item: MaintenanceItem
  dueAtMileage: number
  remainingKm: number
  progress: number
  state: 'ok' | 'soon' | 'due'
}

export interface FuelEntry {
  id: string
  /** Odometer reading at the time of this fill-up. */
  mileage: number
  liters: number
  date: number
}

export interface FuelConsumption {
  entry: FuelEntry
  distanceKm: number
  litersPer100km: number | null
  quality: 'good' | 'bad' | 'neutral'
}
