<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FuelConsumption, HistoryEntry } from '../types'
import SwipeRow from './SwipeRow.vue'
import ConsumptionChart from './ConsumptionChart.vue'
import MonthlySpendChart from './MonthlySpendChart.vue'
import { formatDate } from '../utils/dateFormat'

const props = defineProps<{
  fuelHistory: FuelConsumption[]
  historyEntries: HistoryEntry[]
  averageConsumption: number | null
  totalFuelCost: number
  totalServiceCost: number
  totalCost: number
  hasAnyCost: boolean
}>()

const fuelEntriesRaw = computed(() => props.fuelHistory.map((row) => row.entry))

const emit = defineEmits<{
  addFuel: []
  deleteFuel: [id: string]
  editCost: [id: string]
}>()

const showAll = ref(false)

type Period = 'all' | '30' | '90' | 'year'
const period = ref<Period>('all')
const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'Всё' },
  { key: '30', label: '30 дней' },
  { key: '90', label: '90 дней' },
  { key: 'year', label: 'Год' },
]

const DAY_MS = 24 * 60 * 60 * 1000

const periodFiltered = computed(() => {
  if (period.value === 'all') return props.fuelHistory
  const days = period.value === '30' ? 30 : period.value === '90' ? 90 : 365
  const cutoff = Date.now() - days * DAY_MS
  return props.fuelHistory.filter((row) => row.entry.date >= cutoff)
})

const visible = computed(() => (showAll.value ? periodFiltered.value : periodFiltered.value.slice(0, 8)))

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
      <h1>Расход</h1>
    </header>

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

    <section v-if="fuelHistory.length > 1 || hasAnyCost" class="section charts-section">
      <ConsumptionChart :history="fuelHistory" :average="averageConsumption" />
      <MonthlySpendChart :fuel-entries="fuelEntriesRaw" :history-entries="historyEntries" />
    </section>

    <section class="section">
      <div class="section-title">Заправки</div>
      <div class="period-chips">
        <button
          v-for="p in PERIODS"
          :key="p.key"
          class="period-chip"
          :class="{ active: period === p.key }"
          @click="period = p.key"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="card list">
        <SwipeRow
          v-for="row in visible"
          :key="row.entry.id"
          :right-action="{ label: 'Удалить', colorVar: 'var(--red)', onTrigger: () => emit('deleteFuel', row.entry.id) }"
        >
          <div class="fuel-row">
            <button class="fuel-tap" @click="emit('editCost', row.entry.id)">
              <div class="quality-dot" :class="row.quality" />
              <div class="fuel-info">
                <div class="fuel-main">
                  {{ fmt(row.entry.liters) }} л
                  <span v-if="row.entry.fuelType" class="fuel-type">{{ row.entry.fuelType }}</span>
                  <span v-if="row.litersPer100km !== null" class="fuel-consumption">
                    · {{ row.litersPer100km.toFixed(1) }} л/100км
                  </span>
                  <span v-else-if="row.entry.isFullTank === false" class="fuel-partial">· неполный бак</span>
                  <span v-if="row.entry.cost !== undefined" class="fuel-cost">
                    · {{ fmtCost(row.entry.cost) }}
                  </span>
                </div>
                <div class="fuel-meta">
                  {{ fmt(row.entry.mileage) }} км · {{ formatDate(row.entry.date) }}
                  <template v-if="row.entry.station"> · {{ row.entry.station }}</template>
                </div>
                <div v-if="row.entry.comment" class="fuel-comment">{{ row.entry.comment }}</div>
              </div>
            </button>
            <button class="fuel-delete" aria-label="Удалить заправку" @click="emit('deleteFuel', row.entry.id)">
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
        </SwipeRow>
        <div v-if="periodFiltered.length === 0" class="empty">
          {{ fuelHistory.length === 0 ? 'Нет записей о заправках' : 'Нет записей за этот период' }}
        </div>
        <button v-if="periodFiltered.length > 8" class="show-more" @click="showAll = !showAll">
          {{ showAll ? 'Скрыть' : `Показать все (${periodFiltered.length})` }}
        </button>
      </div>
      <button class="add-item" @click="emit('addFuel')">+ Добавить заправку</button>
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

.section {
  margin-bottom: 24px;
}

.charts-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.period-chips {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  overflow-x: auto;
  padding: 0 4px 2px;
}

.period-chip {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.period-chip.active {
  background: var(--blue);
  color: #fff;
}

.period-chip:active {
  opacity: 0.7;
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

.empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 15px;
}

.list :deep(.swipe-row) {
  border-bottom: 1px solid var(--separator);
}

.list :deep(.swipe-row:last-child) {
  border-bottom: none;
}

.fuel-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 16px;
  background: var(--bg-elevated);
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

.fuel-partial {
  color: var(--text-tertiary);
  font-weight: 400;
}

.fuel-type {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  vertical-align: middle;
}

.fuel-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.fuel-comment {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 2px;
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

.add-item {
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  border-radius: var(--radius-pill);
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
