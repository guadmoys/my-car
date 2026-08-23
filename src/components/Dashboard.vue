<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCarStore } from '../composables/useCarStore'
import { checkAndNotify, checkAndNotifyLowFuel, clearNotifiedItem, updateAppBadge } from '../utils/notifications'
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
import CostEditSheet from './CostEditSheet.vue'
import CarPassportSheet from './CarPassportSheet.vue'
import type { PassportData } from '../utils/carPassport'
import type { FuelEntry, MaintenanceItem, MaintenanceStatus, Part } from '../types'

const store = useCarStore()
const {
  car,
  cars,
  enabledStatuses,
  disabledItems,
  dueCount,
  soonCount,
  okCount,
  fuelHistory,
  averageConsumption,
  estimatedRangeKm,
  averageFuelPrice,
  totalCo2Kg,
  fuelInsights,
  totalFuelCost,
  totalServiceCost,
  totalCost,
  hasAnyCost,
  costForecast,
} = store

const toast = useToast()

const activeTab = ref<TabKey>('dashboard')

const showMileageSheet = ref(false)
const showFuelSheet = ref(false)
const showCarSwitcher = ref(false)
const showAddCar = ref(false)
const showPassportSheet = ref(false)
const editingItem = ref<MaintenanceItem | null | 'new'>(null)
const editingFuelCostId = ref<string | null>(null)
const importError = ref<string | null>(null)

const editingFuelEntry = computed<FuelEntry | null>(
  () => store.fuelEntries.find((e) => e.id === editingFuelCostId.value) ?? null,
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
const lastFuelType = computed(() => lastFuelEntry.value?.fuelType)
const lastStation = computed(() => lastFuelEntry.value?.station)
const lastPrice = computed<number | null>(() => {
  const e = lastFuelEntry.value
  if (!e || e.cost === undefined || e.liters <= 0) return null
  return e.cost / e.liters
})

const STATE_RANK: Record<string, number> = { due: 2, soon: 1, ok: 0 }

const sortedStatuses = computed(() =>
  enabledStatuses.value.slice().sort((a, b) => {
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
  [car, enabledStatuses],
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

async function handleMarkServiced(id: string) {
  const item = store.items.find((i) => i.id === id)
  const result = await store.markServiced(id)
  if (car.value) clearNotifiedItem(car.value.id, id)
  if (!result) return
  haptic('success')
  toast.show(item ? `«${item.name}» — выполнено` : 'Отмечено как выполненное', {
    label: 'Отменить',
    onAction: () => store.undoMarkServiced(id, result),
  })
}

async function handleToggle(id: string, enabled: boolean) {
  haptic('tap')
  await store.toggleItem(id, enabled)
}

async function handleBulkToggle(ids: string[], enabled: boolean) {
  if (ids.length === 0) return
  haptic('tap')
  await Promise.all(ids.map((id) => store.toggleItem(id, enabled)))
}

async function handleReorderDisabled(id: string, direction: 'up' | 'down') {
  await store.reorderDisabledItem(id, direction)
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

async function handleSaveMileage(mileage: number) {
  await store.updateMileage(mileage)
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
}) {
  await store.addFuelEntry(payload)
  showFuelSheet.value = false
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

async function handleSaveFuelCost(cost: number | null) {
  if (editingFuelCostId.value) await store.updateFuelCost(editingFuelCostId.value, cost)
  editingFuelCostId.value = null
}

async function handleUpdateHistoryCost(id: string, cost: number | null) {
  await store.updateHistoryCost(id, cost)
}

async function handleSaveCarInfo(payload: {
  make: string
  model: string
  year: number
  tankCapacity?: number
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

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div v-if="car" class="shell">
    <Transition name="tab-fade" mode="out-in">
    <div class="tabs" :key="activeTab">
      <DashboardTab
        v-if="activeTab === 'dashboard'"
        :car="car"
        :ok-count="okCount"
        :soon-count="soonCount"
        :due-count="dueCount"
        :average-consumption="averageConsumption"
        :total-fuel-cost="totalFuelCost"
        :total-service-cost="totalServiceCost"
        :total-cost="totalCost"
        :has-any-cost="hasAnyCost"
        :urgent-statuses="urgentPreview"
        :urgent-total="urgentStatuses.length"
        :estimated-range-km="estimatedRangeKm"
        @edit-mileage="showMileageSheet = true"
        @switch-car="showCarSwitcher = true"
        @quick-fuel="showFuelSheet = true"
        @open-item="openEditFromDashboard"
        @view-all-maintenance="activeTab = 'maintenance'"
        @view-all-fuel="activeTab = 'fuel'"
      />

      <MaintenanceTab
        v-if="activeTab === 'maintenance'"
        :sorted-statuses="sortedStatuses"
        :disabled-items="disabledItems"
        @mark-serviced="handleMarkServiced"
        @toggle="handleToggle"
        @bulk-toggle="handleBulkToggle"
        @edit="openEdit"
        @delete="handleDeleteItem"
        @reorder-disabled="handleReorderDisabled"
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
        :total-cost="totalCost"
        :has-any-cost="hasAnyCost"
        :cost-forecast="costForecast"
        @add-fuel="showFuelSheet = true"
        @delete-fuel="handleDeleteFuel"
        @edit-cost="editingFuelCostId = $event"
        @export-csv="handleExportFuelCsv"
      />

      <SettingsTab
        v-if="activeTab === 'settings'"
        :car="car"
        :car-count="cars.length"
        :import-error="importError"
        @save="handleSaveCarInfo"
        @delete-car="handleDeleteCar"
        @export="handleExport"
        @import="handleImportFile"
        @open-car-switcher="showCarSwitcher = true"
        @share-passport="showPassportSheet = true"
      />
    </div>
    </Transition>

    <TabBar
      :active-tab="activeTab"
      :due-badge="dueCount"
      :car-initial="car.make.charAt(0).toUpperCase()"
      @change="activeTab = $event"
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
      @update-history-cost="handleUpdateHistoryCost"
    />

    <MileageSheet
      v-if="showMileageSheet"
      :current-mileage="car.currentMileage"
      @close="showMileageSheet = false"
      @save="handleSaveMileage"
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

    <CostEditSheet
      v-if="editingFuelEntry"
      title="Заправка"
      :subtitle="fmtDate(editingFuelEntry.date)"
      :current-cost="editingFuelEntry.cost"
      @close="editingFuelCostId = null"
      @save="handleSaveFuelCost"
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
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
}

.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
