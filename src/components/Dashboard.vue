<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCarStore } from '../composables/useCarStore'
import MaintenanceCard from './MaintenanceCard.vue'
import EditItemModal from './EditItemModal.vue'
import MileageSheet from './MileageSheet.vue'
import SettingsSheet from './SettingsSheet.vue'
import type { MaintenanceItem } from '../types'

const store = useCarStore()
const { car, enabledStatuses, disabledItems, dueCount, soonCount } = store

const showMileageSheet = ref(false)
const showSettingsSheet = ref(false)
const showDisabled = ref(false)
const editingItem = ref<MaintenanceItem | null | 'new'>(null)

const sortedStatuses = computed(() =>
  enabledStatuses.value.slice().sort((a, b) => a.remainingKm - b.remainingKm),
)

const editModalItem = computed(() => (editingItem.value === 'new' ? null : editingItem.value))

function openEdit(id: string) {
  const item = store.items.find((i) => i.id === id)
  if (item) editingItem.value = item
}

function closeEdit() {
  editingItem.value = null
}

async function handleMarkServiced(id: string) {
  await store.markServiced(id)
}

async function handleToggle(id: string, enabled: boolean) {
  await store.toggleItem(id, enabled)
}

async function handleSaveItem(payload: {
  name: string
  intervalKm: number
  intervalKmMax?: number
  lastServiceMileage: number
}) {
  if (editModalItem.value) {
    await store.updateItem(editModalItem.value.id, payload)
  }
  closeEdit()
}

async function handleCreateItem(payload: { name: string; intervalKm: number; intervalKmMax?: number }) {
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

async function handleSaveCarInfo(payload: { make: string; model: string; year: number }) {
  await store.updateCarInfo(payload)
  showSettingsSheet.value = false
}

async function handleReset() {
  await store.resetAll()
  showSettingsSheet.value = false
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <div v-if="car" class="dashboard">
    <header class="topbar">
      <div class="titles">
        <div class="eyebrow">{{ car.year }} · {{ car.make }} {{ car.model }}</div>
        <h1>Моя машина</h1>
      </div>
      <button class="settings-btn" aria-label="Настройки" @click="showSettingsSheet = true">
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

    <button class="mileage-card" @click="showMileageSheet = true">
      <div class="mileage-left">
        <div class="label">Текущий пробег</div>
        <div class="value">{{ fmt(car.currentMileage) }} <span class="unit">км</span></div>
      </div>
      <div class="badges">
        <div v-if="dueCount > 0" class="badge due">{{ dueCount }}</div>
        <div v-if="soonCount > 0" class="badge soon">{{ soonCount }}</div>
      </div>
    </button>

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
      @close="closeEdit"
      @save="handleSaveItem"
      @create="handleCreateItem"
      @delete="handleDeleteItem"
    />

    <MileageSheet
      v-if="showMileageSheet"
      :current-mileage="car.currentMileage"
      @close="showMileageSheet = false"
      @save="handleSaveMileage"
    />

    <SettingsSheet
      v-if="showSettingsSheet"
      :car="car"
      @close="showSettingsSheet = false"
      @save="handleSaveCarInfo"
      @reset="handleReset"
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

.eyebrow {
  font-size: 13px;
  font-weight: 600;
  color: var(--blue);
  text-transform: uppercase;
  letter-spacing: 0.02em;
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

.mileage-card {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, var(--blue), #0040dd);
  color: #fff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--shadow);
  margin-bottom: 28px;
}

.mileage-card:active {
  transform: scale(0.99);
}

.mileage-left {
  text-align: left;
}

.label {
  font-size: 13px;
  opacity: 0.85;
  font-weight: 500;
}

.value {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 2px;
}

.unit {
  font-size: 17px;
  font-weight: 500;
  opacity: 0.85;
}

.badges {
  display: flex;
  gap: 8px;
}

.badge {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.22);
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
</style>
