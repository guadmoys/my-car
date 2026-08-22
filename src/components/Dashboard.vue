<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCarStore } from '../composables/useCarStore'
import { checkAndNotify, clearNotifiedItem, updateAppBadge } from '../utils/notifications'
import MaintenanceCard from './MaintenanceCard.vue'
import EditItemModal from './EditItemModal.vue'
import MileageSheet from './MileageSheet.vue'
import SettingsSheet from './SettingsSheet.vue'
import SummaryCard from './SummaryCard.vue'
import FuelSheet from './FuelSheet.vue'
import CarSwitcherSheet from './CarSwitcherSheet.vue'
import AddCarSheet from './AddCarSheet.vue'
import CostEditSheet from './CostEditSheet.vue'
import type { FuelEntry, MaintenanceItem, Part } from '../types'

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
  totalFuelCost,
  totalServiceCost,
  totalCost,
  hasAnyCost,
} = store

const showMileageSheet = ref(false)
const showSettingsSheet = ref(false)
const showFuelSheet = ref(false)
const showDisabled = ref(false)
const showAllFuel = ref(false)
const showCarSwitcher = ref(false)
const showAddCar = ref(false)
const editingItem = ref<MaintenanceItem | null | 'new'>(null)
const editingFuelCostId = ref<string | null>(null)
const importError = ref<string | null>(null)

const editingFuelEntry = computed<FuelEntry | null>(
  () => store.fuelEntries.find((e) => e.id === editingFuelCostId.value) ?? null,
)

const visibleFuelHistory = computed(() =>
  showAllFuel.value ? fuelHistory.value : fuelHistory.value.slice(0, 5),
)

const sortedStatuses = computed(() =>
  enabledStatuses.value.slice().sort((a, b) => a.remainingKm - b.remainingKm),
)

const editModalItem = computed(() => (editingItem.value === 'new' ? null : editingItem.value))

watch(
  [car, enabledStatuses],
  ([carVal, statusesVal]) => {
    updateAppBadge(dueCount.value + soonCount.value)
    if (carVal) checkAndNotify(carVal.id, statusesVal)
  },
  { immediate: true },
)

function openEdit(id: string) {
  const item = store.items.find((i) => i.id === id)
  if (item) editingItem.value = item
}

function closeEdit() {
  editingItem.value = null
}

async function handleMarkServiced(id: string) {
  await store.markServiced(id)
  if (car.value) clearNotifiedItem(car.value.id, id)
}

async function handleToggle(id: string, enabled: boolean) {
  await store.toggleItem(id, enabled)
}

async function handleSaveItem(payload: {
  name: string
  intervalKm: number
  intervalKmMax?: number
  lastServiceMileage: number
  parts: Part[]
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
  parts: Part[]
}) {
  await store.addCustomItem(payload)
  closeEdit()
}

async function handleDeleteItem(id: string) {
  await store.deleteItem(id)
  closeEdit()
}

async function handleSaveMileage(mileage: number) {
  await store.updateMileage(mileage)
  showMileageSheet.value = false
}

async function handleSaveFuel(payload: { mileage: number; liters: number; cost?: number }) {
  await store.addFuelEntry(payload)
  showFuelSheet.value = false
}

async function handleDeleteFuel(id: string) {
  await store.deleteFuelEntry(id)
}

async function handleSaveFuelCost(cost: number | null) {
  if (editingFuelCostId.value) await store.updateFuelCost(editingFuelCostId.value, cost)
  editingFuelCostId.value = null
}

async function handleUpdateHistoryCost(id: string, cost: number | null) {
  await store.updateHistoryCost(id, cost)
}

async function handleSaveCarInfo(payload: { make: string; model: string; year: number }) {
  await store.updateCarInfo(payload)
  showSettingsSheet.value = false
}

async function handleDeleteCar() {
  if (!car.value) return
  await store.deleteCar(car.value.id)
  showSettingsSheet.value = false
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
  if (result.ok) {
    showSettingsSheet.value = false
  } else {
    importError.value = result.error
  }
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function fmtCost(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}
</script>

<template>
  <div v-if="car" class="dashboard">
    <header class="topbar">
      <div class="titles">
        <h1>Моя машина</h1>
      </div>
      <button
        class="settings-btn"
        aria-label="Настройки"
        @click="importError = null; showSettingsSheet = true"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M19.4 13.5c.1-.5.1-1 0-1.5.5-.4.9-.9 1.2-1.4l-1.5-2.6c-.6.2-1.2.4-1.7.6-.4-.3-.8-.6-1.3-.8-.1-.6-.3-1.2-.5-1.8h-3c-.2.6-.4 1.2-.5 1.8-.5.2-.9.5-1.3.8-.5-.2-1.1-.4-1.7-.6l-1.5 2.6c.3.5.7 1 1.2 1.4-.1.5-.1 1 0 1.5-.5.4-.9.9-1.2 1.4l1.5 2.6c.6-.2 1.2-.4 1.7-.6.4.3.8.6 1.3.8.1.6.3 1.2.5 1.8h3c.2-.6.4-1.2.5-1.8.5-.2.9-.5 1.3-.8.5.2 1.1.4 1.7.6l1.5-2.6c-.3-.5-.7-1-1.2-1.4Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>

    <SummaryCard
      :car="car"
      :ok-count="okCount"
      :soon-count="soonCount"
      :due-count="dueCount"
      :average-consumption="averageConsumption"
      @edit-mileage="showMileageSheet = true"
      @switch-car="showCarSwitcher = true"
    />

    <section v-if="hasAnyCost" class="section">
      <div class="section-title">Расходы</div>
      <div class="card expenses-card">
        <div class="expense-row">
          <span>Топливо</span>
          <span>{{ fmtCost(totalFuelCost) }}</span>
        </div>
        <div class="expense-row">
          <span>ТО</span>
          <span>{{ fmtCost(totalServiceCost) }}</span>
        </div>
        <div class="expense-row total">
          <span>Итого</span>
          <span>{{ fmtCost(totalCost) }}</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Техобслуживание</div>
      <div class="card list">
        <MaintenanceCard
          v-for="status in sortedStatuses"
          :key="status.item.id"
          :status="status"
          @mark-serviced="handleMarkServiced"
          @toggle="handleToggle"
          @edit="openEdit"
        />
        <div v-if="sortedStatuses.length === 0" class="empty">
          Все параметры отключены
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Топливо</div>
      <div class="card list">
        <div v-for="row in visibleFuelHistory" :key="row.entry.id" class="fuel-row">
          <button class="fuel-tap" @click="editingFuelCostId = row.entry.id">
            <div class="quality-dot" :class="row.quality" />
            <div class="fuel-info">
              <div class="fuel-main">
                {{ fmt(row.entry.liters) }} л
                <span v-if="row.litersPer100km !== null" class="fuel-consumption">
                  · {{ row.litersPer100km.toFixed(1) }} л/100км
                </span>
                <span v-if="row.entry.cost !== undefined" class="fuel-cost">
                  · {{ fmtCost(row.entry.cost) }}
                </span>
              </div>
              <div class="fuel-meta">
                {{ fmt(row.entry.mileage) }} км · {{ fmtDate(row.entry.date) }}
              </div>
            </div>
          </button>
          <button class="fuel-delete" aria-label="Удалить заправку" @click="handleDeleteFuel(row.entry.id)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <div v-if="fuelHistory.length === 0" class="empty">Нет записей о заправках</div>
        <button
          v-if="fuelHistory.length > 5"
          class="show-more"
          @click="showAllFuel = !showAllFuel"
        >
          {{ showAllFuel ? 'Скрыть' : `Показать все (${fuelHistory.length})` }}
        </button>
      </div>
      <button class="add-item" @click="showFuelSheet = true">+ Добавить заправку</button>
    </section>

    <section v-if="disabledItems.length > 0" class="section">
      <button class="section-title toggleable" @click="showDisabled = !showDisabled">
        <span>Отключено ({{ disabledItems.length }})</span>
        <span class="caret" :class="{ open: showDisabled }">›</span>
      </button>
      <div v-if="showDisabled" class="card list">
        <div v-for="item in disabledItems" :key="item.id" class="disabled-row">
          <button class="disabled-name" @click="openEdit(item.id)">{{ item.name }}</button>
          <label class="switch">
            <input
              type="checkbox"
              :checked="item.enabled"
              @change="handleToggle(item.id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="slider" />
          </label>
        </div>
      </div>
    </section>

    <button class="add-item" @click="editingItem = 'new'">
      + Добавить параметр
    </button>

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

    <SettingsSheet
      v-if="showSettingsSheet"
      :car="car"
      :import-error="importError"
      @close="showSettingsSheet = false"
      @save="handleSaveCarInfo"
      @delete-car="handleDeleteCar"
      @export="handleExport"
      @import="handleImportFile"
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

    <AddCarSheet
      v-if="showAddCar"
      @close="showAddCar = false"
      @create="handleCreateCar"
    />
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 560px;
  margin: 0 auto;
  padding: calc(16px + var(--safe-top)) 16px calc(48px + var(--safe-bottom));
}

.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 4px 20px;
}

.titles h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 2px 0 0;
}

.settings-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--fill-secondary);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4px;
}

.settings-btn:active {
  opacity: 0.6;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0 4px 8px;
}

.section-title.toggleable {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.caret {
  display: inline-block;
  transform: rotate(90deg);
  transition: transform 0.2s;
}

.caret.open {
  transform: rotate(270deg);
}

.card {
  background: var(--bg-elevated);
  border-radius: 16px;
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 15px;
}

.expenses-card {
  padding: 4px 16px;
}

.expense-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--separator);
  font-size: 16px;
}

.expense-row:last-child {
  border-bottom: none;
}

.expense-row.total {
  font-weight: 700;
}

.expense-row.total span:last-child {
  color: var(--blue);
}

.disabled-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--separator);
}

.disabled-row:last-child {
  border-bottom: none;
}

.disabled-name {
  font-size: 16px;
  color: var(--text-secondary);
  text-align: left;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  background: var(--fill-secondary);
  border-radius: 13px;
  transition: background 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.switch input:checked + .slider {
  background: var(--green);
}

.switch input:checked + .slider::before {
  transform: translateX(18px);
}

.add-item {
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  background: var(--fill-secondary);
  color: var(--blue);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.add-item:active {
  opacity: 0.6;
}

.fuel-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 16px;
  border-bottom: 1px solid var(--separator);
}

.fuel-row:last-child {
  border-bottom: none;
}

.fuel-tap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  text-align: left;
}

.fuel-tap:active {
  opacity: 0.6;
}

.fuel-cost {
  color: var(--blue);
  font-weight: 400;
}

.quality-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-tertiary);
}

.quality-dot.good {
  background: var(--green);
}

.quality-dot.bad {
  background: var(--red);
}

.fuel-info {
  flex: 1;
  min-width: 0;
}

.fuel-main {
  font-size: 16px;
  font-weight: 500;
}

.fuel-consumption {
  color: var(--text-secondary);
  font-weight: 400;
}

.fuel-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.fuel-delete {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.fuel-delete:active {
  background: var(--fill-secondary);
}

.show-more {
  width: 100%;
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--blue);
  border-top: 1px solid var(--separator);
}

.show-more:active {
  opacity: 0.6;
}
</style>
