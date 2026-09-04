<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { IonPage } from '@ionic/vue'
import { useCarStore } from '../composables/useCarStore'
import {
  checkAndNotify,
  checkAndNotifyExpenses,
  checkAndNotifyLowFuel,
  checkAndNotifyReminders,
  clearNotifiedExpense,
  clearNotifiedItem,
  clearNotifiedReminder,
  updateAppBadge,
} from '../utils/notifications'
import { haptic } from '../utils/haptics'
import { useToast } from '../composables/useToast'
import DashboardTab from './DashboardTab.vue'
import MaintenanceTab from './MaintenanceTab.vue'
import FuelTab from './FuelTab.vue'
import SettingsTab from './SettingsTab.vue'
import TabBar, { type TabKey } from './TabBar.vue'
import EditItemModal from './EditItemModal.vue'
import MileageSheet from './MileageSheet.vue'
import FuelSheet from './FuelSheet.vue'
import CarSwitcherSheet from './CarSwitcherSheet.vue'
import AddCarSheet from './AddCarSheet.vue'
import CarPassportSheet from './CarPassportSheet.vue'
import EventsHistorySheet from './EventsHistorySheet.vue'
import ReminderSheet from './ReminderSheet.vue'
import MarkServicedSheet from './MarkServicedSheet.vue'
import MasterListSheet from './MasterListSheet.vue'
import MasterFormSheet from './MasterFormSheet.vue'
import ExpenseListSheet from './ExpenseListSheet.vue'
import ExpenseFormSheet from './ExpenseFormSheet.vue'
import ComponentsSheet from './ComponentsSheet.vue'
import ComponentFormSheet from './ComponentFormSheet.vue'
import TripListSheet from './TripListSheet.vue'
import TripFormSheet from './TripFormSheet.vue'
import type { PassportData } from '../utils/carPassport'
import { generateReportPdf } from '../utils/pdfReport'
import type {
  ComponentType,
  Expense,
  ExpenseCategory,
  FuelEntry,
  MaintenanceItem,
  MaintenanceStatus,
  Master,
  Part,
} from '../types'

const store = useCarStore()
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
  expenseStatuses,
  latestComponentByType,
  totalBusinessKm,
  totalPersonalKm,
} = store

const toast = useToast()

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
const showExpenseList = ref(false)
const editingExpense = ref<Expense | null | 'new'>(null)
const showComponentsSheet = ref(false)
const editingComponentType = ref<ComponentType | null>(null)
const showTripList = ref(false)
const showTripForm = ref(false)
const markServicedItem = ref<MaintenanceItem | null>(null)
const editingItem = ref<MaintenanceItem | null | 'new'>(null)
const editingFuelEntryId = ref<string | null>(null)
const importError = ref<string | null>(null)

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
  ([carVal, statusesVal]) => {
    updateAppBadge(dueCount.value + soonCount.value)
    if (carVal) checkAndNotify(carVal.id, statusesVal)
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
  [car, reminderStatuses],
  ([carVal, statusesVal]) => {
    if (carVal) checkAndNotifyReminders(carVal.id, statusesVal.filter((s) => s.isDue))
  },
  { immediate: true },
)

watch(
  [car, expenseStatuses],
  ([carVal, statusesVal]) => {
    if (carVal) checkAndNotifyExpenses(carVal.id, statusesVal)
  },
  { immediate: true },
)

/** Re-runs the due/soon, low-fuel and reminder checks against the current
 * state, since enabling notifications doesn't itself change `car`/`statuses`
 * and so wouldn't otherwise trigger the watchers below for items already due. */
function handleNotificationsEnabled() {
  if (!car.value) return
  checkAndNotify(car.value.id, statuses.value)
  checkAndNotifyLowFuel(car.value.id, estimatedRangeKm.value)
  checkAndNotifyReminders(car.value.id, reminderStatuses.value.filter((s) => s.isDue))
  checkAndNotifyExpenses(car.value.id, expenseStatuses.value)
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

async function handleConfirmMarkServiced(payload: { cost?: number; receiptPhoto?: string }) {
  const item = markServicedItem.value
  if (!item) return
  markServicedItem.value = null
  const result = await store.markServiced(item.id, undefined, payload.cost, payload.receiptPhoto)
  if (car.value) clearNotifiedItem(car.value.id, item.id)
  if (!result) return
  haptic('success')
  toast.show(`«${item.name}» — выполнено`, {
    label: 'Отменить',
    onAction: () => store.undoMarkServiced(item.id, result),
  })
}

async function handleSaveMaster(payload: {
  name: string
  phone?: string
  cardNumber?: string
  link?: string
  specialty?: string
}) {
  if (editingMaster.value && editingMaster.value !== 'new') {
    await store.updateMaster(editingMaster.value.id, payload)
  } else {
    await store.addMaster(payload)
  }
  editingMaster.value = null
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

async function handleSaveExpense(payload: {
  category: ExpenseCategory
  title?: string
  amount: number
  date: number
  renewalDate?: number
  note?: string
  receiptPhoto?: string
}) {
  if (editingExpense.value && editingExpense.value !== 'new') {
    await store.updateExpense(editingExpense.value.id, payload)
  } else {
    await store.addExpense(payload)
  }
  editingExpense.value = null
}

async function handleDeleteExpense(id: string) {
  const expense = store.expenses.find((e) => e.id === id)
  const removed = await store.deleteExpense(id)
  if (!removed) return
  if (car.value) clearNotifiedExpense(car.value.id, id)
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
  await store.addComponentCheck(payload)
  editingComponentType.value = null
  haptic('success')
}

async function handleSaveTrip(payload: {
  startMileage: number
  endMileage: number
  purpose: 'business' | 'personal'
  date?: number
  note?: string
}) {
  await store.addTrip(payload)
  showTripForm.value = false
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

function handleExportPdf() {
  if (!car.value) return
  generateReportPdf({
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
  })
}

async function handleAddCarPhoto(dataUrl: string) {
  await store.addCarPhoto(dataUrl)
}

async function handleRemoveCarPhoto(index: number) {
  await store.removeCarPhoto(index)
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
  if (editModalItem.value) {
    await store.updateItem(editModalItem.value.id, payload)
  }
  closeEdit()
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
  await store.addCustomItem(payload)
  closeEdit()
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
  await store.updateMileage(mileage, date, { allowDecrease: isRollback })
  showMileageSheet.value = false
}

async function handleSaveFuel(payload: {
  mileage: number
  liters: number
  cost?: number
  fuelType?: string
  isFullTank?: boolean
  remainingLiters?: number
  station?: string
  comment?: string
  receiptPhoto?: string
}) {
  await store.addFuelEntry(payload)
  showFuelSheet.value = false
}

async function handleSaveReminder(payload: {
  text: string
  dueMileage?: number
  dueDate?: number
  hasTime?: boolean
}) {
  await store.addReminder(payload)
  showReminderSheet.value = false
}

async function handleDeleteReminder(id: string) {
  const removed = await store.deleteReminder(id)
  if (!removed) return
  if (car.value) clearNotifiedReminder(car.value.id, id)
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
  await store.updateFuelEntry(editingFuelEntryId.value, {
    ...payload,
    date: payload.date ?? entry?.date ?? Date.now(),
  })
  editingFuelEntryId.value = null
}

async function handleUpdateHistory(
  id: string,
  payload: { itemName: string; mileage: number; date: number; cost?: number; receiptPhoto?: string },
) {
  await store.updateHistoryEntry(id, payload)
}

async function handleSaveCarInfo(payload: {
  make: string
  model: string
  year: number
  tankCapacity?: number
  vin?: string
  licensePlate?: string
  stsNumber?: string
  referenceConsumptionL100km?: number
}) {
  await store.updateCarInfo(payload)
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
  await store.createCar(payload)
  showAddCar.value = false
  showCarSwitcher.value = false
}

async function handleExport() {
  const data = await store.exportData()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const dateStr = new Date().toISOString().slice(0, 10)

  const link = document.createElement('a')
  link.href = url
  link.download = `moya-mashina-backup-${dateStr}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function csvEscape(value: string): string {
  return /["\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function handleExportFuelCsv() {
  const rows = store.fuelEntries.slice().sort((a, b) => a.date - b.date)
  const header = ['Дата', 'Пробег, км', 'Литры', 'Стоимость, ₽', 'Цена, ₽/л', 'Вид топлива', 'Полный бак', 'АЗС', 'Комментарий']
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

  const confirmed = window.confirm(
    'Импорт полностью заменит текущие данные (машина, параметры ТО, заправки, история) содержимым файла. Продолжить?',
  )
  if (!confirmed) return

  const result = await store.importData(parsed)
  if (!result.ok) importError.value = result.error
}
</script>

<template>
  <ion-page v-if="car">
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
        @edit-mileage="showMileageSheet = true"
        @switch-car="showCarSwitcher = true"
        @quick-fuel="showFuelSheet = true"
        @open-item="openEditFromDashboard"
        @view-all-maintenance="activeTab = 'maintenance'"
        @view-all-fuel="activeTab = 'fuel'"
        @view-all-events="showEventsSheet = true"
        @add-reminder="showReminderSheet = true"
        @delete-reminder="handleDeleteReminder"
        @view-other-expenses="showExpenseList = true"
      />

      <MaintenanceTab
        v-if="activeTab === 'maintenance'"
        :sorted-statuses="sortedStatuses"
        @mark-serviced="handleMarkServiced"
        @edit="openEdit"
        @delete="handleDeleteItem"
        @bulk-delete="handleBulkDelete"
        @add-item="editingItem = 'new'"
      />

      <FuelTab
        v-if="activeTab === 'fuel'"
        :fuel-history="fuelHistory"
        :history-entries="store.historyEntries"
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
        @view-other-expenses="showExpenseList = true"
      />

      <SettingsTab
        v-if="activeTab === 'settings'"
        :car="car"
        :car-count="cars.length"
        :master-count="store.masters.length"
        :expense-count="store.expenses.length"
        :trip-count="store.trips.length"
        :import-error="importError"
        @save="handleSaveCarInfo"
        @delete-car="handleDeleteCar"
        @export="handleExport"
        @export-pdf="handleExportPdf"
        @import="handleImportFile"
        @open-car-switcher="showCarSwitcher = true"
        @open-masters="showMasterList = true"
        @open-expenses="showExpenseList = true"
        @open-components="showComponentsSheet = true"
        @open-trips="showTripList = true"
        @add-photo="handleAddCarPhoto"
        @remove-photo="handleRemoveCarPhoto"
        @share-passport="showPassportSheet = true"
        @notifications-enabled="handleNotificationsEnabled"
      />

    <TabBar
      :active-tab="activeTab"
      :due-badge="dueCount"
      @change="activeTab = $event"
      @quick-mileage="showMileageSheet = true"
      @quick-fuel="showFuelSheet = true"
      @quick-reminder="showReminderSheet = true"
    />

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

    <ExpenseListSheet
      v-if="showExpenseList"
      :expenses="store.expenses"
      :expense-statuses="expenseStatuses"
      :total="totalExpensesCost"
      @close="showExpenseList = false"
      @edit="editingExpense = $event"
      @delete="handleDeleteExpense"
      @add-expense="editingExpense = 'new'"
    />

    <ExpenseFormSheet
      v-if="editingExpense !== null"
      :expense="editingExpense !== 'new' ? editingExpense : null"
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
