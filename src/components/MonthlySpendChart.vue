<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FuelEntry, HistoryEntry } from '../types'

const props = defineProps<{
  fuelEntries: FuelEntry[]
  historyEntries: HistoryEntry[]
}>()

const activeKey = ref<string | null>(null)

const MONTHS_BACK = 6
const W = 100
const H = 40
const PAD_TOP = 4
const PAD_BOTTOM = 4

function monthKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}`
}

const months = computed(() => {
  const now = new Date()
  const keys: { key: string; label: string }[] = []
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('ru-RU', { month: 'short' }) })
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
const maxValue = computed(() => Math.max(...totals.value.map((m) => m.total), 1) * 1.15)
const activeMonth = computed(() => totals.value.find((m) => m.key === activeKey.value) ?? null)

function xAt(i: number): number {
  const n = totals.value.length
  return n <= 1 ? W / 2 : ((i + 0.5) / n) * W
}

function yAt(value: number): number {
  const usable = H - PAD_TOP - PAD_BOTTOM
  return PAD_TOP + (1 - value / maxValue.value) * usable
}

const coords = computed(() => totals.value.map((m, i) => ({ month: m, x: xAt(i), y: yAt(m.total) })))

const linePath = computed(() =>
  coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
)

const areaPath = computed(() => {
  if (coords.value.length === 0) return ''
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return `${linePath.value} L ${last.x.toFixed(1)},${H} L ${first.x.toFixed(1)},${H} Z`
})

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
      <svg class="chart-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--blue)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--blue)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="areaPath" fill="url(#spend-area)" stroke="none" />
        <path :d="linePath" fill="none" stroke="var(--blue)" stroke-width="1.6" vector-effect="non-scaling-stroke" />
        <circle
          v-for="c in coords"
          :key="c.month.key"
          :cx="c.x"
          :cy="c.y"
          :r="c.month.key === activeKey ? 2.6 : 2"
          fill="var(--blue)"
          stroke="var(--bg-elevated)"
          stroke-width="1"
        />
      </svg>
      <div class="hit-row">
        <button
          v-for="c in coords"
          :key="c.month.key"
          class="hit"
          :aria-label="`${c.month.label}: ${fmtCost(c.month.total)}`"
          @click="toggle(c.month.key)"
        />
      </div>
    </div>

    <div class="month-labels">
      <span v-for="m in totals" :key="m.key" class="month-label">{{ m.label }}</span>
    </div>

    <div class="chart-footer">
      <span v-if="activeMonth">{{ activeMonth.label }} · {{ fmtCost(activeMonth.total) }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
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
  height: 92px;
}

.chart-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.hit-row {
  position: absolute;
  inset: 0;
  display: flex;
}

.hit {
  flex: 1;
  height: 100%;
}

.month-labels {
  display: flex;
  margin-top: 6px;
}

.month-label {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.chart-footer {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  min-height: 15px;
}
</style>
