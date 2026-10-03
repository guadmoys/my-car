<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { IonPage, IonTab, IonTabs } from '@ionic/vue'
import { currency } from '../utils/currency'
import { useCarStore } from '../composables/useCarStore'
import { checkAndNotifyBudget, checkAndNotifyLowFuel, updateAppBadge } from '../utils/notifications'
import { registerBackgroundCheck, runAlertsNow, scheduleAlertCycle } from '../composables/useAlerts'
import { haptic } from '../utils/haptics'
import { useToast } from '../composables/useToast'
import DashboardTab from './DashboardTab.vue'
// Everything except the home screen is fetched on demand: each sheet or tab is its own chunk, which keeps the first
// load small. The service worker precaches all chunks, so this still works offline, and after the first paint the
// chunks are warmed in the background so opening a sheet never waits.
const prefetchers: (() => Promise<unknown>)[] = []
function lazy(loader: () => Promise<unknown>) {
  prefetchers.push(loader)
  return defineAsyncComponent(loader as Parameters<typeof defineAsyncComponent>[0])
}

const MaintenanceTab = lazy(() => import('./MaintenanceTab.vue'))
const FuelTab = lazy(() => import('./FuelTab.vue'))
const SettingsTab = lazy(() => import('./SettingsTab.vue'))
import TabBar, { type TabKey } from './TabBar.vue'
const EditItemModal = lazy(() => import('./EditItemModal.vue'))
const MileageSheet = lazy(() => import('./MileageSheet.vue'))
const FuelSheet = lazy(() => import('./FuelSheet.vue'))
const CarSwitcherSheet = lazy(() => import('./CarSwitcherSheet.vue'))
const AddCarSheet = lazy(() => import('./AddCarSheet.vue'))
const CarPassportSheet = lazy(() => import('./CarPassportSheet.vue'))
const EventsHistorySheet = lazy(() => import('./EventsHistorySheet.vue'))
const ReminderSheet = lazy(() => import('./ReminderSheet.vue'))
const MarkServicedSheet = lazy(() => import('./MarkServicedSheet.vue'))
const MasterListSheet = lazy(() => import('./MasterListSheet.vue'))
const MasterFormSheet = lazy(() => import('./MasterFormSheet.vue'))
import { buildCostStructure } from '../utils/costStructure'
import { isVaultEnabled } from '../utils/vault'
import { resolveBackupData } from '../utils/backupFile'
import { askBackupSecret } from '../utils/secretPrompt'
import { buildExpensesCsv } from '../utils/expensesCsv'
import { buildWarranties } from '../utils/warranty'
import { monthSpend, monthlyBudget } from '../utils/budget'
import { buildPartsList } from '../utils/partsList'
const PartsHistorySheet = lazy(() => import('./PartsHistorySheet.vue'))
import { useBackup } from '../composables/useBackup'
import { confirmDialog } from '../utils/confirmDialog'
import { buildMasterStats } from '../utils/masterStats'
const ExpenseListSheet = lazy(() => import('./ExpenseListSheet.vue'))
const DocumentsSheet = lazy(() => import('./DocumentsSheet.vue'))
const DocumentFormSheet = lazy(() => import('./DocumentFormSheet.vue'))
const ExpenseFormSheet = lazy(() => import('./ExpenseFormSheet.vue'))
const ComponentsSheet = lazy(() => import('./ComponentsSheet.vue'))
const ComponentFormSheet = lazy(() => import('./ComponentFormSheet.vue'))
const TripListSheet = lazy(() => import('./TripListSheet.vue'))
const TripFormSheet = lazy(() => import('./TripFormSheet.vue'))
import type { PassportData } from '../utils/carPassport'
import { generateReportPdf } from '../utils/pdfReport'
import { buildMoyaMashinaCsv, parseMoyaMashinaCsv } from '../utils/carCsvFormat'
import type {
  ComponentType,
  Expense,
  ExpenseItem,
  ExpensePayload,
  CarDocument,
  DocumentType,
  FuelEntry,
  MaintenanceItem,
  MaintenanceStatus,
  Master,
  Part,
} from '../types'


const store = useCarStore()
const backup = useBackup()
const {
  car,
  cars,
  statuses,
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
  totalExpensesCost,
  totalCost,
  hasAnyCost,
  costForecast,
  reminderStatuses,
  documentStatuses,
  latestComponentByType,
  totalBusinessKm,
  totalPersonalKm,
} = store

const toast = useToast()

onMounted(() => {
  // Warm the lazy chunks one by one once the browser is idle, so the first tap on a tab or sheet is instant.
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn) : setTimeout(fn, 1500))
  idle(() => {
    void prefetchers.reduce((chain, load) => chain.then(() => load()).catch(() => undefined), Promise.resolve<unknown>(undefined))
  })
})

// A rapid double-tap on a sheet's "Готово" fires its click handler twice
// before the first async store write resolves and the sheet closes — there's
// no per-sheet "already submitting" state, so both taps go through and
// create two records from one intended save. This is the single shared lock
// every create/update handler below goes through: the second tap is simply
// ignored rather than producing a visible duplicate (or, for edits, a
// harmless redundant write).
const isSubmitting = ref(false)
async function submitOnce(fn: () => Promise<void>): Promise<void> {
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    await fn()
  } finally {
    isSubmitting.value = false
  }
}

const activeTab = ref<TabKey>('dashboard')

const showMileageSheet = ref(false)
const showFuelSheet = ref(false)
const showCarSwitcher = ref(false)
const showAddCar = ref(false)
const showPassportSheet = ref(false)
const showEventsSheet = ref(false)
const showReminderSheet = ref(false)
const showMasterList = ref(false)
const editingMaster = ref<Master | null | 'new'>(null)
const warranties = computed(() => buildWarranties(store.historyEntries, store.expenses, Date.now()))
const thisMonthSpend = computed(() => monthSpend(store.fuelEntries, store.historyEntries, store.expenses, Date.now()))
const masterStats = computed(() => buildMasterStats(store.historyEntries, store.expenses))
const showPartsSheet = ref(false)
const partsRows = computed(() => buildPartsList(store.historyEntries, store.expenses))
const showExpenseList = ref(false)
const showDocuments = ref(false)
const editingDocument = ref<CarDocument | null | 'new'>(null)
const newDocumentType = ref<DocumentType | undefined>(undefined)
const editingExpense = ref<Expense | null | 'new'>(null)
const showComponentsSheet = ref(false)
const editingComponentType = ref<ComponentType | null>(null)
const showTripList = ref(false)
const showTripForm = ref(false)
const markServicedItem = ref<MaintenanceItem | null>(null)
const editingItem = ref<MaintenanceItem | null | 'new'>(null)
const editingFuelEntryId = ref<string | null>(null)
const importError = ref<string | null>(null)
const importCsvError = ref<string | null>(null)

const editingFuelEntry = computed<FuelEntry | null>(
  () => store.fuelEntries.find((e) => e.id === editingFuelEntryId.value) ?? null,
)

// Opens the matching sheet when launched from a PWA shortcut (manifest.shortcuts
// links to "?action=fuel"/"?action=mileage"), then strips the param so a
// later reload of the same tab doesn't reopen it.
onMounted(() => {
  const url = new URL(window.location.href)
  const action = url.searchParams.get('action')
  if (action === 'fuel') showFuelSheet.value = true
  else if (action === 'mileage') showMileageSheet.value = true
  if (action) {
    url.searchParams.delete('action')
    window.history.replaceState({}, '', url)
  }
})

const lastFuelEntry = computed<FuelEntry | null>(() => {
  if (store.fuelEntries.length === 0) return null
  return store.fuelEntries.slice().sort((a, b) => b.date - a.date)[0]
})
const latestConsumption = computed<number | null>(
  () => fuelHistory.value.find((row) => row.litersPer100km !== null)?.litersPer100km ?? null,
)
const recentEvents = computed(() => timelineEvents.value.slice(0, 4))
const lastFuelType = computed(() => lastFuelEntry.value?.fuelType)
const lastStation = computed(() => lastFuelEntry.value?.station)
const lastPrice = computed<number | null>(() => {
  const e = lastFuelEntry.value
  if (!e || e.cost === undefined || e.liters <= 0) return null
  return e.cost / e.liters
})
// store.expenses is already newest-first (addExpense unshifts), so [0] is the latest.
const lastExpenseCategory = computed(() => store.expenses[0]?.category)

const STATE_RANK: Record<string, number> = { due: 2, soon: 1, ok: 0 }

const sortedStatuses = computed(() =>
  statuses.value.slice().sort((a, b) => {
    const rankDiff = STATE_RANK[b.state] - STATE_RANK[a.state]
    return rankDiff !== 0 ? rankDiff : a.remainingKm - b.remainingKm
  }),
)

const urgentStatuses = computed<MaintenanceStatus[]>(() =>
  sortedStatuses.value.filter((s) => s.state !== 'ok'),
)
const urgentPreview = computed(() => urgentStatuses.value.slice(0, 3))

const editModalItem = computed(() => (editingItem.value === 'new' ? null : editingItem.value))

const passportData = computed<PassportData | null>(() => {
  if (!car.value) return null
  return {
    car: car.value,
    okCount: okCount.value,
    soonCount: soonCount.value,
    dueCount: dueCount.value,
    averageConsumption: averageConsumption.value,
    totalFuelCost: totalFuelCost.value,
    totalServiceCost: totalServiceCost.value,
    totalCost: totalCost.value,
    hasAnyCost: hasAnyCost.value,
    recentHistory: store.historyEntries
      .slice()
      .sort((a, b) => b.date - a.date)
      .slice(0, 5),
  }
})

watch(
  [car, statuses],
  () => {
    updateAppBadge(dueCount.value + soonCount.value)
  },
  { immediate: true },
)

watch(
  [car, estimatedRangeKm],
  ([carVal, rangeVal]) => {
    if (carVal) checkAndNotifyLowFuel(carVal.id, rangeVal)
  },
  { immediate: true },
)

watch(
  [car, thisMonthSpend, monthlyBudget],
  ([carVal, spent, budget]) => {
    if (carVal) checkAndNotifyBudget(carVal.id, spent, budget)
  },
  { immediate: true },
)

/** A change in anything the alert engine reads re-runs it (debounced), for every car. */
watch(
  () => [
    car.value?.currentMileage,
    statuses.value.map((x) => `${x.item.id}:${x.state}`).join(),
    reminderStatuses.value.map((x) => `${x.reminder.id}:${x.isDue}`).join(),
    documentStatuses.value.map((x) => `${x.document.id}:${x.document.expiryDate}`).join(),
    warranties.value.map((x) => x.key).join(),
  ],
  () => scheduleAlertCycle(),
)

/** Enabling notifications doesn't change any data, so run the checks once for what is already due. */
function handleNotificationsEnabled() {
  void runAlertsNow()
  void registerBackgroundCheck()
  if (!car.value) return
  checkAndNotifyLowFuel(car.value.id, estimatedRangeKm.value)
  checkAndNotifyBudget(car.value.id, thisMonthSpend.value, monthlyBudget.value)
}

function openEdit(id: string) {
  const item = store.items.find((i) => i.id === id)
  if (item) editingItem.value = item
}

function openEditFromDashboard(id: string) {
  activeTab.value = 'maintenance'
  openEdit(id)
}

function closeEdit() {
  editingItem.value = null
}

function handleMarkServiced(id: string) {
  const item = store.items.find((i) => i.id === id)
  if (item) markServicedItem.value = item
}

async function handleConfirmMarkServiced(payload: { cost?: number; receiptPhoto?: string; items?: ExpenseItem[]; masterId?: string }) {
  const item = markServicedItem.value
  if (!item) return
  markServicedItem.value = null
  await submitOnce(async () => {
    let result: Awaited<ReturnType<typeof store.markServiced>>
    try {
      result = await store.markServiced(item.id, undefined, payload.cost, payload.receiptPhoto, undefined, payload.items, payload.masterId)
    } catch {
      toast.show('Не удалось сохранить — попробуйте ещё раз')
      return
    }
    if (!result) return
    haptic('success')
    toast.show(`«${item.name}» — выполнено`, {
      label: 'Отменить',
      onAction: () => store.undoMarkServiced(item.id, result),
    })
  })
}

async function handleSaveMaster(payload: {
  name: string
  phone?: string
  cardNumber?: string
  link?: string
  specialty?: string
}) {
  await submitOnce(async () => {
    if (editingMaster.value && editingMaster.value !== 'new') {
      await store.updateMaster(editingMaster.value.id, payload)
    } else {
      await store.addMaster(payload)
    }
    editingMaster.value = null
  })
}

async function handleDeleteMaster(id: string) {
  const master = store.masters.find((m) => m.id === id)
  const removed = await store.deleteMaster(id)
  if (!removed) return
  haptic('delete')
  toast.show(master ? `«${master.name}» удалён` : 'Мастер удалён', {
    label: 'Отменить',
    onAction: () => store.restoreMaster(removed),
  })
}

async function handleSaveExpense(payload: ExpensePayload) {
  await submitOnce(async () => {
    const isNew = !editingExpense.value || editingExpense.value === 'new'
    if (editingExpense.value && editingExpense.value !== 'new') {
      await store.updateExpense(editingExpense.value.id, payload)
    } else {
      await store.addExpense(payload)
    }
    editingExpense.value = null
    if (isNew) {
      haptic('success')
      toast.show('Расход добавлен')
    }
  })
}

async function handleDeleteExpense(id: string) {
  const expense = store.expenses.find((e) => e.id === id)
  const removed = await store.deleteExpense(id)
  if (!removed) return
  haptic('delete')
  toast.show(expense ? 'Расход удалён' : 'Запись удалена', {
    label: 'Отменить',
    onAction: () => store.restoreExpense(removed),
  })
}

async function handleSaveComponentCheck(payload: {
  type: ComponentType
  season?: 'summer' | 'winter' | 'allseason'
  treadDepthMm?: number
  pressureFront?: number
  pressureRear?: number
  thicknessMm?: number
  installedDate?: number
  note?: string
}) {
  await submitOnce(async () => {
    await store.addComponentCheck(payload)
    editingComponentType.value = null
    haptic('success')
    toast.show('Запись добавлена')
  })
}

async function handleSaveTrip(payload: {
  startMileage: number
  endMileage: number
  purpose: 'business' | 'personal'
  date?: number
  note?: string
}) {
  await submitOnce(async () => {
    await store.addTrip(payload)
    showTripForm.value = false
    haptic('success')
    toast.show('Поездка добавлена')
  })
}

async function handleDeleteTrip(id: string) {
  const removed = await store.deleteTrip(id)
  if (!removed) return
  haptic('delete')
  toast.show('Поездка удалена', {
    label: 'Отменить',
    onAction: () => store.restoreTrip(removed),
  })
}

/** CSV tables and the PDF report are plain files even with encryption on; make that explicit before saving one. */
async function confirmPlainExport(): Promise<boolean> {
  if (!isVaultEnabled()) return true
  return confirmDialog('Эта выгрузка не шифруется: файл можно будет открыть без пароля. Продолжить?', { confirmText: 'Сохранить' })
}

async function handleExportPdf() {
  if (!(await confirmPlainExport())) return
  if (!car.value) return
  try {
    await generateReportPdf({
    car: car.value,
    statuses: statuses.value,
    totalFuelCost: totalFuelCost.value,
    totalServiceCost: totalServiceCost.value,
    totalExpensesCost: totalExpensesCost.value,
    totalCost: totalCost.value,
    expenses: store.expenses,
    trips: store.trips,
    totalBusinessKm: totalBusinessKm.value,
    totalPersonalKm: totalPersonalKm.value,
    recentHistory: store.historyEntries.slice().sort((a, b) => b.date - a.date),
    structure: buildCostStructure(store.fuelEntries, store.historyEntries, store.expenses),
    })
  } catch {
    toast.show('Не удалось создать PDF — попробуйте ещё раз')
  }
}

async function handleSaveDocument(payload: {
  type: DocumentType
  title?: string
  number?: string
  issuedDate?: number
  expiryDate?: number
  photos: string[]
  note?: string
}) {
  await submitOnce(async () => {
    const editing = editingDocument.value
    if (editing && editing !== 'new') {
      await store.updateDocument(editing.id, payload)
      haptic('success')
    } else {
      await store.addDocument(payload)
      haptic('success')
      toast.show('Документ добавлен')
    }
    editingDocument.value = null
    newDocumentType.value = undefined
  })
}

async function handleDeleteDocument(id: string) {
  const document = store.documents.find((d) => d.id === id)
  const removed = await store.deleteDocument(id)
  if (!removed) return
  editingDocument.value = null
  haptic('delete')
  toast.show(document ? 'Документ удалён' : 'Запись удалена', {
    label: 'Отменить',
    onAction: () => store.restoreDocument(removed),
  })
}

function openNewDocument(type?: DocumentType) {
  newDocumentType.value = type
  editingDocument.value = 'new'
}

async function handleSaveItem(payload: {
  name: string
  intervalKm: number
  intervalKmMax?: number
  intervalMonths?: number
  lastServiceMileage: number
  parts: Part[]
  notifyBeforeKm?: number
  notifyBeforeDays?: number
}) {
  await submitOnce(async () => {
    if (editModalItem.value) {
      await store.updateItem(editModalItem.value.id, payload)
    }
    closeEdit()
  })
}

async function handleCreateItem(payload: {
  name: string
  intervalKm: number
  intervalKmMax?: number
  intervalMonths?: number
  parts: Part[]
  notifyBeforeKm?: number
  notifyBeforeDays?: number
}) {
  await submitOnce(async () => {
    await store.addCustomItem(payload)
    closeEdit()
  })
}

async function handleDeleteItem(id: string) {
  const item = store.items.find((i) => i.id === id)
  const removed = await store.deleteItem(id)
  closeEdit()
  if (!removed) return
  haptic('delete')
  toast.show(item ? `«${item.name}» удалён` : 'Параметр удалён', {
    label: 'Отменить',
    onAction: () => store.restoreItem(removed),
  })
}

async function handleBulkDelete(ids: string[]) {
  if (ids.length === 0) return
  const removed = (await Promise.all(ids.map((id) => store.deleteItem(id)))).filter(
    (item): item is MaintenanceItem => item !== null,
  )
  if (removed.length === 0) return
  haptic('delete')
  toast.show(removed.length === 1 ? `«${removed[0].name}» удалён` : `Удалено параметров: ${removed.length}`, {
    label: 'Отменить',
    onAction: () => Promise.all(removed.map((item) => store.restoreItem(item))),
  })
}

async function handleSaveMileage(mileage: number, date: number, isRollback: boolean) {
  await submitOnce(async () => {
    const applied = await store.updateMileage(mileage, date, { allowDecrease: isRollback })
    showMileageSheet.value = false
    if (!applied) {
      toast.show('Уже есть более поздняя запись пробега — текущий пробег не изменён')
      return
    }
    haptic('success')
    toast.show('Пробег обновлён')
  })
}

async function handleSaveFuel(payload: {
  mileage: number
  liters: number
  date?: number
  cost?: number
  fuelType?: string
  isFullTank?: boolean
  remainingLiters?: number
  station?: string
  comment?: string
  receiptPhoto?: string
}) {
  await submitOnce(async () => {
    await store.addFuelEntry(payload)
    showFuelSheet.value = false
    haptic('success')
    toast.show('Заправка добавлена')
  })
}

async function handleSaveReminder(payload: {
  text: string
  dueMileage?: number
  dueDate?: number
  hasTime?: boolean
}) {
  await submitOnce(async () => {
    await store.addReminder(payload)
    showReminderSheet.value = false
    haptic('success')
    toast.show('Напоминание добавлено')
  })
}

async function handleDeleteReminder(id: string) {
  const removed = await store.deleteReminder(id)
  if (!removed) return
  haptic('success')
  toast.show(`«${removed.text}» — готово`, {
    label: 'Отменить',
    onAction: () => store.restoreReminder(removed),
  })
}

async function handleDeleteFuel(id: string) {
  const removed = await store.deleteFuelEntry(id)
  if (!removed) return
  haptic('delete')
  toast.show('Заправка удалена', {
    label: 'Отменить',
    onAction: () => store.restoreFuelEntry(removed),
  })
}

async function handleSaveFuelEntry(payload: {
  mileage: number
  liters: number
  date?: number
  cost?: number
  fuelType?: string
  isFullTank?: boolean
  remainingLiters?: number
  station?: string
  comment?: string
  receiptPhoto?: string
}) {
  if (!editingFuelEntryId.value) return
  const entry = editingFuelEntry.value
  await submitOnce(async () => {
    await store.updateFuelEntry(editingFuelEntryId.value!, {
      ...payload,
      date: payload.date ?? entry?.date ?? Date.now(),
    })
    editingFuelEntryId.value = null
  })
}

async function handleUpdateHistory(
  id: string,
  payload: { itemName: string; mileage: number; date: number; cost?: number; receiptPhoto?: string; note?: string; items?: ExpenseItem[]; masterId?: string },
) {
  await submitOnce(() => store.updateHistoryEntry(id, payload))
}

async function handleSaveCarInfo(payload: {
  make: string
  model: string
  year: number
  tankCapacity?: number
  vin?: string
  licensePlate?: string
  referenceConsumptionL100km?: number
}) {
  await submitOnce(() => store.updateCarInfo(payload))
}

async function handleDeleteCar() {
  if (!car.value) return
  await store.deleteCar(car.value.id)
}

async function handleSwitchCar(id: string) {
  await store.switchCar(id)
}

async function handleDeleteCarFromSwitcher(id: string) {
  await store.deleteCar(id)
}

async function handleCreateCar(payload: {
  make: string
  model: string
  year: number
  initialMileage: number
}) {
  await submitOnce(async () => {
    await store.createCar(payload)
    showAddCar.value = false
    showCarSwitcher.value = false
  })
}

async function handleExport() {
  // Encrypted with the vault key when encryption is on; saved to the chosen folder, the share sheet or a download.
  await backup.saveNow()
}

function csvEscape(value: string): string {
  return /["\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleExportExpensesCsv() {
  if (!(await confirmPlainExport())) return
  const csv = buildExpensesCsv(timelineEvents.value, currency.value, (id) => store.masters.find((m) => m.id === id)?.name)
  downloadCsv(`rashody-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

async function handleExportFuelCsv() {
  if (!(await confirmPlainExport())) return
  const rows = store.fuelEntries.slice().sort((a, b) => a.date - b.date)
  const header = ['Дата', 'Пробег, км', 'Литры', `Стоимость, ${currency.value}`, `Цена, ${currency.value}/л`, 'Вид топлива', 'Полный бак', 'АЗС', 'Комментарий']
  const lines = [header.join(',')]
  for (const e of rows) {
    const price = e.cost !== undefined && e.liters > 0 ? (e.cost / e.liters).toFixed(2) : ''
    lines.push(
      [
        new Date(e.date).toLocaleDateString('ru-RU'),
        String(e.mileage),
        String(e.liters),
        e.cost !== undefined ? String(e.cost) : '',
        price,
        csvEscape(e.fuelType ?? ''),
        e.isFullTank === false ? 'нет' : 'да',
        csvEscape(e.station ?? ''),
        csvEscape(e.comment ?? ''),
      ].join(','),
    )
  }

  const csv = '\uFEFF' + lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const dateStr = new Date().toISOString().slice(0, 10)

  const link = document.createElement('a')
  link.href = url
  link.download = `zapravki-${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleImportFile(file: File) {
  importError.value = null
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    importError.value = 'Не удалось прочитать файл — это не корректный JSON'
    return
  }

  const opened = await resolveBackupData(parsed, askBackupSecret)
  if (!opened.ok) {
    if (opened.error !== 'Отменено') importError.value = opened.error
    return
  }

  const confirmed = await confirmDialog(
    'Импорт полностью заменит текущие данные (машина, параметры ТО, заправки, история) содержимым файла. Продолжить?',
    { header: 'Импорт копии', confirmText: 'Заменить данные', destructive: true },
  )
  if (!confirmed) return

  const result = await store.importData(opened.data)
  if (!result.ok) importError.value = result.error
  else if (result.skipped > 0) toast.show(`Данные загружены. Пропущено повреждённых записей: ${result.skipped}`)
}

async function handleExportCarCsv() {
  if (!(await confirmPlainExport())) return
  if (!car.value) return
  const csv = buildMoyaMashinaCsv({ fuel: store.fuelEntries, history: store.historyEntries })
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const dateStr = new Date().toISOString().slice(0, 10)

  const link = document.createElement('a')
  link.href = url
  link.download = `moya-mashina-${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleImportCarCsv(file: File) {
  importCsvError.value = null
  if (!car.value) return

  let text: string
  try {
    text = await file.text()
  } catch {
    importCsvError.value = 'Не удалось прочитать файл'
    return
  }

  const parsed = parseMoyaMashinaCsv(text)
  if (parsed.fuel.length === 0 && parsed.service.length === 0 && parsed.parts.length === 0) {
    importCsvError.value = 'В файле не нашлось ни одной записи в формате «Моя машина» (Заправки/Сервис/Детали)'
    return
  }

  const summary = await store.importCarCsv(parsed)
  haptic('success')
  const added = summary.fuelAdded + summary.serviceAdded + summary.partsAdded
  const skipped = summary.fuelSkipped + summary.serviceSkipped
  const parts = [
    `Заправок добавлено: ${summary.fuelAdded}`,
    `Записей ТО добавлено: ${summary.serviceAdded + summary.partsAdded}`,
  ]
  if (skipped > 0) parts.push(`уже было: ${skipped}`)
  if (summary.partsSkippedNoDate > 0) parts.push(`деталей без даты установки пропущено: ${summary.partsSkippedNoDate}`)
  toast.show(added > 0 ? parts.join(', ') : 'Новых записей не найдено — похоже, файл уже импортирован')
}
</script>

<template>
  <ion-page v-if="car">
    <ion-tabs>
      <ion-tab tab="dashboard">
    <DashboardTab
        v-if="activeTab === 'dashboard'"
        :car="car"
        :ok-count="okCount"
        :soon-count="soonCount"
        :due-count="dueCount"
        :average-consumption="averageConsumption"
        :latest-consumption="latestConsumption"
        :month-distance-km="monthDistanceKm"
        :recent-events="recentEvents"
        :events-total="timelineEvents.length"
        :total-fuel-cost="totalFuelCost"
        :total-service-cost="totalServiceCost"
        :total-expenses-cost="totalExpensesCost"
        :total-cost="totalCost"
        :has-any-cost="hasAnyCost"
        :urgent-statuses="urgentPreview"
        :urgent-total="urgentStatuses.length"
        :estimated-range-km="estimatedRangeKm"
        :reminder-statuses="reminderStatuses"
        :document-statuses="documentStatuses"
        :document-count="store.documents.length"
        :warranties="warranties"
        :backup-due="backup.state.due"
        :backup-days="backup.state.daysSince"
        :backup-never="backup.state.never"
        :backup-saving="backup.state.saving"
        @save-backup="backup.saveNow()"
        @snooze-backup="backup.snooze()"
        :month-spend="thisMonthSpend"
        @open-documents="showDocuments = true"
        @edit-mileage="showMileageSheet = true"
        @switch-car="showCarSwitcher = true"
        @quick-fuel="showFuelSheet = true"
        @quick-expense="editingExpense = 'new'"
        @open-item="openEditFromDashboard"
        @mark-serviced="handleMarkServiced"
        @view-all-maintenance="activeTab = 'maintenance'"
        @view-all-fuel="activeTab = 'fuel'"
        @view-all-events="showEventsSheet = true"
        @add-reminder="showReminderSheet = true"
        @delete-reminder="handleDeleteReminder"
        @view-other-expenses="showExpenseList = true"
      />
      </ion-tab>

      <ion-tab tab="maintenance">
      <MaintenanceTab
        v-if="activeTab === 'maintenance'"
        :sorted-statuses="sortedStatuses"
        @mark-serviced="handleMarkServiced"
        @edit="openEdit"
        @delete="handleDeleteItem"
        @bulk-delete="handleBulkDelete"
        @add-item="editingItem = 'new'"
      />
      </ion-tab>

      <ion-tab tab="fuel">
      <FuelTab
        v-if="activeTab === 'fuel'"
        :fuel-history="fuelHistory"
        :history-entries="store.historyEntries"
        :expenses="store.expenses"
        :average-consumption="averageConsumption"
        :fuel-insights="fuelInsights"
        :total-co2-kg="totalCo2Kg"
        :total-fuel-cost="totalFuelCost"
        :total-service-cost="totalServiceCost"
        :total-expenses-cost="totalExpensesCost"
        :total-cost="totalCost"
        :has-any-cost="hasAnyCost"
        :cost-forecast="costForecast"
        @add-fuel="showFuelSheet = true"
        @delete-fuel="handleDeleteFuel"
        @edit-fuel="editingFuelEntryId = $event"
        @export-csv="handleExportFuelCsv"
        @export-expenses-csv="handleExportExpensesCsv"
        @view-parts="showPartsSheet = true"
        @view-other-expenses="showExpenseList = true"
      />
      </ion-tab>

      <ion-tab tab="settings">
      <SettingsTab
        v-if="activeTab === 'settings'"
        :car="car"
        :car-count="cars.length"
        :master-count="store.masters.length"
        :expense-count="store.expenses.length"
        :document-count="store.documents.length"
        :trip-count="store.trips.length"
        :import-error="importError"
        :import-csv-error="importCsvError"
        @save="handleSaveCarInfo"
        @delete-car="handleDeleteCar"
        @export="handleExport"
        @export-pdf="handleExportPdf"
        @import="handleImportFile"
        @export-csv="handleExportCarCsv"
        @import-csv="handleImportCarCsv"
        @open-car-switcher="showCarSwitcher = true"
        @open-masters="showMasterList = true"
        @open-expenses="showExpenseList = true"
        @open-components="showComponentsSheet = true"
        @open-trips="showTripList = true"
        @open-documents="showDocuments = true"
        @share-passport="showPassportSheet = true"
        @notifications-enabled="handleNotificationsEnabled"
      />
      </ion-tab>

    <TabBar
      :active-tab="activeTab"
      :due-badge="dueCount"
      @change="activeTab = $event"
      @quick-mileage="showMileageSheet = true"
      @quick-fuel="showFuelSheet = true"
      @quick-reminder="showReminderSheet = true"
      @quick-expense="editingExpense = 'new'"
    />
    </ion-tabs>

    <EditItemModal
      v-if="editingItem !== null"
      :item="editModalItem"
      :current-mileage="car.currentMileage"
      :history="editModalItem ? store.getItemHistory(editModalItem.id) : []"
      @close="closeEdit"
      @save="handleSaveItem"
      @create="handleCreateItem"
      @delete="handleDeleteItem"
      @update-history="handleUpdateHistory"
    />

    <MileageSheet
      v-if="showMileageSheet"
      :car="car"
      :fuel-entries="store.fuelEntries"
      :history-entries="store.historyEntries"
      @close="showMileageSheet = false"
      @save="handleSaveMileage"
    />

    <ReminderSheet
      v-if="showReminderSheet"
      :current-mileage="car.currentMileage"
      @close="showReminderSheet = false"
      @save="handleSaveReminder"
    />

    <FuelSheet
      v-if="showFuelSheet"
      :car="car"
      :fuel-entries="store.fuelEntries"
      :history-entries="store.historyEntries"
      :current-mileage="car.currentMileage"
      :tank-capacity="car.tankCapacity"
      :average-price="averageFuelPrice"
      :last-fuel-type="lastFuelType"
      :last-station="lastStation"
      :last-price="lastPrice"
      :last-mileage="lastFuelEntry?.mileage"
      @close="showFuelSheet = false"
      @save="handleSaveFuel"
    />

    <FuelSheet
      v-if="editingFuelEntry"
      :entry="editingFuelEntry"
      :car="car"
      :fuel-entries="store.fuelEntries"
      :history-entries="store.historyEntries"
      :current-mileage="car.currentMileage"
      :tank-capacity="car.tankCapacity"
      :average-price="averageFuelPrice"
      :last-fuel-type="lastFuelType"
      :last-station="lastStation"
      :last-price="lastPrice"
      :last-mileage="lastFuelEntry?.mileage"
      @close="editingFuelEntryId = null"
      @save="handleSaveFuelEntry"
    />

    <CarPassportSheet
      v-if="showPassportSheet && passportData"
      :data="passportData"
      @close="showPassportSheet = false"
    />

    <CarSwitcherSheet
      v-if="showCarSwitcher"
      :cars="cars"
      :active-car-id="car.id"
      @close="showCarSwitcher = false"
      @switch="handleSwitchCar"
      @delete="handleDeleteCarFromSwitcher"
      @add-car="showAddCar = true"
    />

    <AddCarSheet v-if="showAddCar" @close="showAddCar = false" @create="handleCreateCar" />

    <EventsHistorySheet
      v-if="showEventsSheet"
      :events="timelineEvents"
      @close="showEventsSheet = false"
    />

    <MarkServicedSheet
      v-if="markServicedItem"
      :item-name="markServicedItem.name"
      @close="markServicedItem = null"
      @save="handleConfirmMarkServiced"
    />

    <MasterListSheet
      v-if="showMasterList"
      :masters="store.masters"
      :stats="masterStats"
      @close="showMasterList = false"
      @edit="editingMaster = $event"
      @delete="handleDeleteMaster"
      @add-master="editingMaster = 'new'"
    />

    <MasterFormSheet
      v-if="editingMaster !== null"
      :master="editingMaster !== 'new' ? editingMaster : null"
      @close="editingMaster = null"
      @save="handleSaveMaster"
    />

    <DocumentsSheet
      v-if="showDocuments"
      :documents="store.documents"
      :statuses="documentStatuses"
      @close="showDocuments = false"
      @add="openNewDocument"
      @edit="editingDocument = $event"
      @delete="handleDeleteDocument"
    />

    <DocumentFormSheet
      v-if="editingDocument !== null"
      :document="editingDocument !== 'new' ? editingDocument : null"
      :preset-type="newDocumentType"
      @close="editingDocument = null; newDocumentType = undefined"
      @save="handleSaveDocument"
      @delete="handleDeleteDocument"
    />

    <PartsHistorySheet
      v-if="showPartsSheet"
      :rows="partsRows"
      :master-name="(id: string) => store.masters.find((m) => m.id === id)?.name"
      @close="showPartsSheet = false"
    />

    <ExpenseListSheet
      v-if="showExpenseList"
      :expenses="store.expenses"
      :total="totalExpensesCost"
      @close="showExpenseList = false"
      @edit="editingExpense = $event"
      @delete="handleDeleteExpense"
      @add-expense="editingExpense = 'new'"
    />

    <ExpenseFormSheet
      v-if="editingExpense !== null"
      :expense="editingExpense !== 'new' ? editingExpense : null"
      :last-category="lastExpenseCategory"
      @close="editingExpense = null"
      @save="handleSaveExpense"
    />

    <ComponentsSheet
      v-if="showComponentsSheet"
      :latest-by-type="latestComponentByType"
      @close="showComponentsSheet = false"
      @update="editingComponentType = $event"
    />

    <ComponentFormSheet
      v-if="editingComponentType !== null"
      :type="editingComponentType"
      @close="editingComponentType = null"
      @save="handleSaveComponentCheck"
    />

    <TripListSheet
      v-if="showTripList"
      :trips="store.trips"
      :total-business-km="totalBusinessKm"
      :total-personal-km="totalPersonalKm"
      @close="showTripList = false"
      @delete="handleDeleteTrip"
      @add-trip="showTripForm = true"
    />

    <TripFormSheet
      v-if="showTripForm"
      :current-mileage="car.currentMileage"
      @close="showTripForm = false"
      @save="handleSaveTrip"
    />
  </ion-page>
</template>
