<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FuelConsumption } from '../types'

const props = defineProps<{
  fuelHistory: FuelConsumption[]
  totalFuelCost: number
  totalServiceCost: number
  totalCost: number
  hasAnyCost: boolean
}>()

const emit = defineEmits<{
  addFuel: []
  deleteFuel: [id: string]
  editCost: [id: string]
}>()

const showAll = ref(false)

const visible = computed(() => (showAll.value ? props.fuelHistory : props.fuelHistory.slice(0, 8)))

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

    <section class="section">
      <div class="section-title">Заправки</div>
      <div class="card list">
        <div v-for="row in visible" :key="row.entry.id" class="fuel-row">
          <button class="fuel-tap" @click="emit('editCost', row.entry.id)">
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
        <div v-if="fuelHistory.length === 0" class="empty">Нет записей о заправках</div>
        <button v-if="fuelHistory.length > 8" class="show-more" @click="showAll = !showAll">
          {{ showAll ? 'Скрыть' : `Показать все (${fuelHistory.length})` }}
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
  border-radius: 16px;
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  overflow: hidden;
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
</style>
