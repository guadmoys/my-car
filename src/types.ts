export interface Car {
  id: string
  make: string
  model: string
  year: number
  initialMileage: number
  currentMileage: number
  createdAt: number
  updatedAt: number
  /** Fuel tank volume, in liters. Optional; when set, enables precise consumption tracking for partial fill-ups via `FuelEntry.remainingLiters`. */
  tankCapacity?: number
  /** Vehicle identification number. */
  vin?: string
  /** Registration plate ("госномер"). */
  licensePlate?: string
  /** Registration certificate number ("СТС"). */
  stsNumber?: string
  /** Photos of the car itself and its documents (STS, insurance, etc), stored as compressed data URLs. */
  photos?: string[]
  /**
   * Manufacturer-declared or otherwise expected average consumption, l/100km.
   * User-entered: this app is offline-first with no backend, so there's no
   * real crowdsourced fleet average to compare against — this is a local
   * stand-in the user fills in themselves (e.g. from the manual).
   */
  referenceConsumptionL100km?: number
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
  /**
   * A soft calendar-date guess for a purely km-based item, derived from the
   * car's average daily mileage (from fuel history). Only set when there's
   * no explicit `dueAtDate` and enough driving data to estimate a pace.
   */
  estimatedDueDate?: number
  progress: number
  state: 'ok' | 'soon' | 'due'
}

/**
 * A one-off manual reminder ("напоминание"), distinct from recurring
 * MaintenanceItems: it fires once, either when the odometer reaches
 * `dueMileage` or when the current time passes `dueDate`, then stays in the
 * list (marked due) until the user deletes it. Exactly one of `dueMileage`/
 * `dueDate` is set per reminder.
 */
export interface Reminder {
  id: string
  carId: string
  /** Free-text description, e.g. "проверить масло". */
  text: string
  createdAt: number
  /** Fires once the car's odometer reaches this reading. */
  dueMileage?: number
  /** Fires once the current time passes this timestamp. */
  dueDate?: number
  /** Whether dueDate carries a specific time of day, vs. just a calendar day. */
  hasTime?: boolean
}

export interface ReminderStatus {
  reminder: Reminder
  isDue: boolean
  /** Set when the reminder targets an odometer reading. */
  remainingKm?: number
  /** Set when the reminder targets a date. */
  remainingDays?: number
}

/**
 * A trusted mechanic/service provider ("проверенный мастер") the user has
 * used before and wants to keep on hand for next time.
 */
export interface Master {
  id: string
  carId: string
  name: string
  /** Phone number to reach them. */
  phone?: string
  /** Bank card number for sending payment. */
  cardNumber?: string
  /** Link to their profile/chat/listing (Telegram, Avito, VK, etc). */
  link?: string
  /** What they do, e.g. "Развал-схождение", "Кузовной ремонт". */
  specialty?: string
  createdAt: number
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
  /** Photo of the receipt/invoice for this service, as a compressed data URL. */
  receiptPhoto?: string
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
  /** Fuel grade, e.g. "АИ-95", "Дизель". Informational only. */
  fuelType?: string
  /** Whether the tank was filled to the top. Defaults to true when absent (matches legacy entries), since the consumption formula anchors on full-tank fill-ups. */
  isFullTank?: boolean
  /** Estimated liters left in the tank right before this fill-up. Lets partial (non-full) fill-ups act as a precise consumption anchor too, on par with a full-tank fill. Ignored when isFullTank is true. */
  remainingLiters?: number
  /** Gas station name/location. Informational only. */
  station?: string
  /** Free-text note. Informational only. */
  comment?: string
  /** Photo of the receipt for this fill-up, as a compressed data URL. */
  receiptPhoto?: string
}

/** Non-fuel, non-service running cost — the categories a car owner pays for besides gas and repairs. */
export type ExpenseCategory = 'insurance' | 'parking' | 'fine' | 'tax' | 'loan' | 'other'

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  insurance: 'Страховка',
  parking: 'Парковка/платная дорога',
  fine: 'Штраф',
  tax: 'Налог/ОСАГО/техосмотр',
  loan: 'Кредит/лизинг',
  other: 'Другое',
}

/**
 * A one-off or recurring non-fuel/non-service expense (insurance, fines,
 * parking, taxes, loan/lease payments). `renewalDate`, when set, is when
 * this expense needs renewing/repeating (e.g. a policy's end date) — used
 * to drive a due/soon reminder the same way MaintenanceItem/Reminder do.
 */
export interface Expense {
  id: string
  carId: string
  category: ExpenseCategory
  /** Free-text label, e.g. "ОСАГО Ингосстрах". Falls back to the category label when absent. */
  title?: string
  amount: number
  date: number
  renewalDate?: number
  note?: string
  /** Photo of the receipt/invoice, as a compressed data URL. */
  receiptPhoto?: string
}

export interface ExpenseStatus {
  expense: Expense
  isDue: boolean
  isSoon: boolean
  remainingDays?: number
}

/** Which serviceable component a ComponentCheck record is about. */
export type ComponentType = 'tires' | 'battery' | 'brakePads'

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  tires: 'Шины',
  battery: 'Аккумулятор',
  brakePads: 'Тормозные колодки',
}

/**
 * A logged reading for one serviceable component. New readings are appended
 * (like HistoryEntry) rather than overwriting the previous one, so there's a
 * history of measurements over time; the latest one per (carId, type) is
 * what's shown as the "current" state.
 */
export interface ComponentCheck {
  id: string
  carId: string
  type: ComponentType
  mileage: number
  date: number
  /** tires: which set is currently mounted. */
  season?: 'summer' | 'winter' | 'allseason'
  /** tires: tread depth, mm. */
  treadDepthMm?: number
  /** tires: pressure, front axle, bar. */
  pressureFront?: number
  /** tires: pressure, rear axle, bar. */
  pressureRear?: number
  /** brakePads: remaining pad thickness, mm. */
  thicknessMm?: number
  /** battery: installation date (may differ from `date`, the date this was logged). */
  installedDate?: number
  note?: string
}

/** A trip logged for personal/business mileage record-keeping (tax purposes). */
export interface Trip {
  id: string
  carId: string
  date: number
  startMileage: number
  endMileage: number
  purpose: 'business' | 'personal'
  note?: string
}

export interface FuelConsumption {
  entry: FuelEntry
  distanceKm: number
  litersPer100km: number | null
  quality: 'good' | 'bad' | 'neutral'
}

/** An auto-generated observation or recommendation derived from fuel history. */
export interface FuelInsight {
  id: string
  icon: string
  text: string
  tone: 'good' | 'bad' | 'neutral'
}

/** Projected cost of ownership over a horizon, split by category. */
export interface CostForecast {
  fuel: number
  maintenance: number
  total: number
}

/** A fuel fill-up or a completed maintenance item, merged into one date-sorted feed for the home screen. */
export type TimelineEvent =
  | { kind: 'fuel'; id: string; date: number; mileage: number; entry: FuelEntry }
  | { kind: 'service'; id: string; date: number; mileage: number; entry: HistoryEntry }

export interface BackupData {
  version: 2
  exportedAt: number
  cars: Car[]
  activeCarId: string | null
  items: MaintenanceItem[]
  fuelEntries: FuelEntry[]
  historyEntries: HistoryEntry[]
  /** Absent when importing a backup made before reminders existed. */
  reminders?: Reminder[]
  /** Absent when importing a backup made before trusted masters existed. */
  masters?: Master[]
  /** Absent when importing a backup made before other expenses existed. */
  expenses?: Expense[]
  /** Absent when importing a backup made before component checks existed. */
  components?: ComponentCheck[]
  /** Absent when importing a backup made before trips existed. */
  trips?: Trip[]
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
