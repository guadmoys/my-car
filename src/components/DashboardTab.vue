<script setup lang="ts">
import { computed } from 'vue'
import type { Car, MaintenanceStatus } from '../types'
import SummaryCard from './SummaryCard.vue'

const props = defineProps<{
  car: Car
  okCount: number
  soonCount: number
  dueCount: number
  averageConsumption: number | null
  totalFuelCost: number
  totalServiceCost: number
  totalCost: number
  hasAnyCost: boolean
  urgentStatuses: MaintenanceStatus[]
  urgentTotal: number
  estimatedRangeKm: number | null
}>()

// Low-fuel threshold matches the "скоро на заправку" cutoff already used
// for the fuelInsights range warning, so this card and that insight agree.
const LOW_FUEL_RANGE_KM = 60

type PriorityAction =
  | { kind: 'maintenance'; status: MaintenanceStatus }
  | { kind: 'fuel'; rangeKm: number }
  | { kind: 'ok' }

// A single top recommendation, folding maintenance urgency and fuel range
// into one place instead of making the user check both the urgent-items
// list and the Заправки tab separately. urgentStatuses is already
// urgency-sorted (due before soon, most overdue first), so its first
// matching entry is the single most urgent one of that kind.
const priorityAction = computed<PriorityAction>(() => {
  const topDue = props.urgentStatuses.find((s) => s.state === 'due')
  if (topDue) return { kind: 'maintenance', status: topDue }
  if (props.estimatedRangeKm !== null && props.estimatedRangeKm <= LOW_FUEL_RANGE_KM) {
    return { kind: 'fuel', rangeKm: props.estimatedRangeKm }
  }
  const topSoon = props.urgentStatuses.find((s) => s.state === 'soon')
  if (topSoon) return { kind: 'maintenance', status: topSoon }
  return { kind: 'ok' }
})

const emit = defineEmits<{
  editMileage: []
  switchCar: []
  quickFuel: []
  openItem: [id: string]
  viewAllMaintenance: []
  viewAllFuel: []
}>()

function stateColor(state: MaintenanceStatus['state']): string {
  return state === 'due' ? 'var(--red)' : state === 'soon' ? 'var(--orange)' : 'var(--green)'
}

function statusText(status: MaintenanceStatus): string {
  const km = Math.abs(Math.round(status.remainingKm))
  if (status.remainingDays !== undefined && status.remainingDays <= 0) {
    return `Просрочено по дате на ${Math.abs(status.remainingDays)} дн.`
  }
  if (status.remainingKm <= 0) {
    return km === 0 ? 'Пора провести ТО' : `Просрочено на ${fmt(km)} км`
  }
  if (status.remainingDays !== undefined && status.state === 'soon') {
    return `Осталось ${status.remainingDays} дн. или ${fmt(km)} км`
  }
  return `Осталось ${fmt(km)} км`
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtCost(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}
</script>

<template>
  <div class="tab-page">
    <header class="topbar">
      <h1>Обзор</h1>
    </header>

    <SummaryCard
      :car="car"
      :ok-count="okCount"
      :soon-count="soonCount"
      :due-count="dueCount"
      :average-consumption="averageConsumption"
      @edit-mileage="emit('editMileage')"
      @switch-car="emit('switchCar')"
    />

    <div class="quick-actions">
      <button class="quick-btn" @click="emit('editMileage')">
        <span class="quick-icon">🛣️</span>
        Пробег
      </button>
      <button class="quick-btn" @click="emit('quickFuel')">
        <span class="quick-icon">⛽</span>
        Заправка
      </button>
    </div>

    <section v-if="priorityAction.kind !== 'ok'" class="section">
      <div class="section-title">Сделать сейчас</div>
      <button
        class="priority-card"
        :class="priorityAction.kind === 'fuel' ? 'fuel' : priorityAction.status.state"
        @click="
          priorityAction.kind === 'fuel' ? emit('quickFuel') : emit('openItem', priorityAction.status.item.id)
        "
      >
        <span class="priority-icon">{{ priorityAction.kind === 'fuel' ? '⛽' : '🔧' }}</span>
        <span class="priority-info">
          <span class="priority-title">
            {{ priorityAction.kind === 'fuel' ? 'Залить топливо' : priorityAction.status.item.name }}
          </span>
          <span class="priority-meta">
            {{
              priorityAction.kind === 'fuel'
                ? `Осталось ~${Math.round(priorityAction.rangeKm)} км хода`
                : statusText(priorityAction.status)
            }}
          </span>
        </span>
        <span class="chevron">›</span>
      </button>
    </section>

    <section v-if="hasAnyCost" class="section">
      <div class="section-title">Расходы</div>
      <button class="card expenses-card" @click="emit('viewAllFuel')">
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
      </button>
    </section>

    <section class="section">
      <div class="section-title">Требует внимания</div>
      <div class="card list">
        <button
          v-for="status in urgentStatuses"
          :key="status.item.id"
          class="urgent-row"
          @click="emit('openItem', status.item.id)"
        >
          <span class="urgent-dot" :style="{ background: stateColor(status.state) }" />
          <span class="urgent-info">
            <span class="urgent-name">{{ status.item.name }}</span>
            <span class="urgent-meta">{{ statusText(status) }}</span>
          </span>
          <span class="chevron">›</span>
        </button>
        <div v-if="urgentStatuses.length === 0" class="empty ok">Всё в порядке ✅</div>
      </div>
      <button v-if="urgentTotal > urgentStatuses.length" class="show-more" @click="emit('viewAllMaintenance')">
        Смотреть все ({{ urgentTotal }})
      </button>
    </section>
  </div>
</template>

<style scoped>
.tab-page {
  max-width: 560px;
  margin: 0 auto;
  padding: calc(16px + var(--safe-top)) 16px calc(96px + var(--safe-bottom));
}

.topbar {
  padding: 8px 4px 20px;
}

.topbar h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.quick-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}

.quick-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.quick-btn:active {
  opacity: 0.6;
}

.quick-icon {
  font-size: 26px;
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

.card {
  width: 100%;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  overflow: hidden;
  text-align: left;
}

.priority-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  background: var(--bg-elevated);
  text-align: left;
}

.priority-card.due,
.priority-card.fuel {
  background: color-mix(in srgb, var(--red) 8%, var(--bg-elevated));
  border-color: color-mix(in srgb, var(--red) 30%, var(--card-border));
}

.priority-card.soon {
  background: color-mix(in srgb, var(--orange) 8%, var(--bg-elevated));
  border-color: color-mix(in srgb, var(--orange) 30%, var(--card-border));
}

.priority-card:active {
  opacity: 0.7;
}

.priority-icon {
  font-size: 26px;
  flex-shrink: 0;
}

.priority-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.priority-title {
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.priority-meta {
  font-size: 14px;
  color: var(--text-secondary);
}

.expenses-card {
  padding: 4px 16px;
}

.expenses-card:active {
  opacity: 0.8;
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

.urgent-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--separator);
  text-align: left;
}

.urgent-row:last-child {
  border-bottom: none;
}

.urgent-row:active {
  opacity: 0.6;
}

.urgent-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.urgent-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.urgent-name {
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.urgent-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.chevron {
  color: var(--text-tertiary);
  font-size: 18px;
  font-weight: 500;
}

.empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 15px;
}

.empty.ok {
  color: var(--green);
  font-weight: 600;
}

.show-more {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--blue);
}

.show-more:active {
  opacity: 0.6;
}
</style>
