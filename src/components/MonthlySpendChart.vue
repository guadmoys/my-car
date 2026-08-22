<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FuelEntry, HistoryEntry } from '../types'

const props = defineProps<{
  fuelEntries: FuelEntry[]
  historyEntries: HistoryEntry[]
}>()

const activeKey = ref<string | null>(null)

const MONTHS_BACK = 6

function monthKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}`
}

const months = computed(() => {
  const now = new Date()
  const keys: { key: string; label: string; year: number; month: number }[] = []
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('ru-RU', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    })
  }
  return keys
})

const totals = computed(() => {
  const map = new Map<string, number>()
  for (const e of props.fuelEntries) {
    if (e.cost === undefined) continue
    map.set(monthKey(e.date), (map.get(monthKey(e.date)) ?? 0) + e.cost)
  }
  for (const h of props.historyEntries) {
    if (h.cost === undefined) continue
    map.set(monthKey(h.date), (map.get(monthKey(h.date)) ?? 0) + h.cost)
  }
  return months.value.map((m) => ({ ...m, total: map.get(m.key) ?? 0 }))
})

const hasData = computed(() => totals.value.some((m) => m.total > 0))
const maxValue = computed(() => Math.max(...totals.value.map((m) => m.total), 1))
const activeMonth = computed(() => totals.value.find((m) => m.key === activeKey.value) ?? null)

function heightPct(value: number): number {
  return value === 0 ? 2 : Math.max(4, (value / maxValue.value) * 100)
}

function fmtCost(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

function toggle(key: string) {
  activeKey.value = activeKey.value === key ? null : key
}
</script>

<template>
  <div v-if="hasData" class="chart-card">
    <div class="chart-header">
      <span class="chart-title">Расходы по месяцам</span>
    </div>

    <div class="chart-area">
      <button
        v-for="m in totals"
        :key="m.key"
        class="bar-col"
        :aria-label="`${m.label}: ${fmtCost(m.total)}`"
        @click="toggle(m.key)"
      >
        <div class="bar" :class="{ active: activeKey === m.key }" :style="{ height: `${heightPct(m.total)}%` }" />
        <span class="bar-label">{{ m.label }}</span>
      </button>
    </div>

    <div class="chart-footer">
      <span v-if="activeMonth">{{ activeMonth.label }} · {{ fmtCost(activeMonth.total) }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart-card {
  background: var(--bg-elevated);
  border-radius: 16px;
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  padding: 14px 16px 12px;
}

.chart-header {
  margin-bottom: 12px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
}

.chart-area {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 92px;
}

.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
}

.bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: var(--blue);
  transition: opacity 0.15s ease;
}

.bar.active,
.bar-col:active .bar {
  opacity: 0.6;
}

.bar-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.chart-footer {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  min-height: 15px;
}
</style>
