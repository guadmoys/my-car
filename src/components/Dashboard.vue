<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { IonPage, IonTab, IonTabs } from '@ionic/vue'
import { useCarStore } from '../composables/useCarStore'
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
import { buildWarranties } from '../utils/money/warranty'
import { monthSpend } from '../utils/money/budget'
import { buildPartsList } from '../utils/money/partsList'
const PartsHistorySheet = lazy(() => import('./PartsHistorySheet.vue'))
import { useBackup } from '../composables/useBackup'
import { useDashboardAlerts } from '../composables/useDashboardAlerts'
import { useMaintenanceSheets } from '../composables/useMaintenanceSheets'
import { useFuelSheets } from '../composables/useFuelSheets'
import { useRecordSheets } from '../composables/useRecordSheets'
import { submitOnce } from '../composables/useSubmitOnce'
import { useDataTransfer } from '../composables/useDataTransfer'
import { buildMasterStats } from '../utils/money/masterStats'
const ExpenseListSheet = lazy(() => import('./ExpenseListSheet.vue'))
const DocumentsSheet = lazy(() => import('./DocumentsSheet.vue'))
const DocumentFormSheet = lazy(() => import('./DocumentFormSheet.vue'))
const ExpenseFormSheet = lazy(() => import('./ExpenseFormSheet.vue'))
const ComponentsSheet = lazy(() => import('./ComponentsSheet.vue'))
const ComponentFormSheet = lazy(() => import('./ComponentFormSheet.vue'))
const TripListSheet = lazy(() => import('./TripListSheet.vue'))
const TripFormSheet = lazy(() => import('./TripFormSheet.vue'))
import type { PassportData } from '../utils/carPassport'
import type {
  FuelEntry,
  MaintenanceStatus,
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

const {
  markServicedItem,
  editingItem,
  editModalItem,
  openEdit,
  closeEdit,
  handleMarkServiced,
  handleConfirmMarkServiced,
  handleSaveItem,
  handleCreateItem,
  handleDeleteItem,
  handleBulkDelete,
  handleUpdateHistory,
} = useMaintenanceSheets()
const {
  showMileageSheet,
  showFuelSheet,
  showReminderSheet,
  editingFuelEntryId,
  editingFuelEntry,
  handleSaveMileage,
  handleSaveFuel,
  handleSaveReminder,
  handleDeleteReminder,
  handleDeleteFuel,
  handleSaveFuelEntry,
} = useFuelSheets()
const {
  editingMaster,
  editingExpense,
  editingComponentType,
  showTripForm,
  editingDocument,
  newDocumentType,
  handleSaveMaster,
  handleDeleteMaster,
  handleSaveExpense,
  handleDeleteExpense,
  handleSaveComponentCheck,
  handleSaveTrip,
  handleDeleteTrip,
  handleSaveDocument,
  handleDeleteDocument,
  openNewDocument,
} = useRecordSheets()
const { importError, importCsvError, exportPdf, exportBackup, exportExpensesCsv, exportFuelCsv, exportCarCsv, importBackupFile, importCarCsv } =
  useDataTransfer()

onMounted(() => {
  // Warm the lazy chunks one by one once the browser is idle, so the first tap on a tab or sheet is instant.
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn) : setTimeout(fn, 1500))
  idle(() => {
    void prefetchers.reduce((chain, load) => chain.then(() => load()).catch(() => undefined), Promise.resolve<unknown>(undefined))
  })
})

const activeTab = ref<TabKey>('dashboard')

const showCarSwitcher = ref(false)
const showAddCar = ref(false)
const showPassportSheet = ref(false)
const showEventsSheet = ref(false)
const showMasterList = ref(false)
const warranties = computed(() => buildWarranties(store.historyEntries, store.expenses, Date.now()))
const thisMonthSpend = computed(() => monthSpend(store.fuelEntries, store.historyEntries, store.expenses, Date.now()))
const masterStats = computed(() => buildMasterStats(store.historyEntries, store.expenses))
const { handleNotificationsEnabled } = useDashboardAlerts(thisMonthSpend, computed(() => warranties.value.map((w) => w.key)))
const showPartsSheet = ref(false)
const partsRows = computed(() => buildPartsList(store.historyEntries, store.expenses))
const showExpenseList = ref(false)
const showDocuments = ref(false)
const showComponentsSheet = ref(false)
const showTripList = ref(false)


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

function openEditFromDashboard(id: string) {
  activeTab.value = 'maintenance'
  openEdit(id)
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
        @export-csv="exportFuelCsv"
        @export-expenses-csv="exportExpensesCsv"
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
        @export="exportBackup"
        @export-pdf="exportPdf"
        @import="importBackupFile"
        @export-csv="exportCarCsv"
        @import-csv="importCarCsv"
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
