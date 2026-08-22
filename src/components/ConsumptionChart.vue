<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FuelConsumption } from '../types'

const props = defineProps<{
  history: FuelConsumption[]
  average: number | null
}>()

const activeId = ref<string | null>(null)

const bars = computed(() => {
  return props.history
    .filter((row) => row.litersPer100km !== null)
    .slice(-10)
})

const maxValue = computed(() => {
  const values = bars.value.map((b) => b.litersPer100km ?? 0)
  const avg = props.average ?? 0
  return Math.max(avg, ...values, 1) * 1.15
})

const averagePct = computed(() =>
  props.average !== null ? Math.min(100, (props.average / maxValue.value) * 100) : null,
)

const activeRow = computed(() => bars.value.find((b) => b.entry.id === activeId.value) ?? null)

function heightPct(value: number | null): number {
  if (value === null) return 0
  return Math.max(4, (value / maxValue.value) * 100)
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function toggle(id: string) {
  activeId.value = activeId.value === id ? null : id
}
</script>

<template>
  <div v-if="bars.length > 0" class="chart-card">
    <div class="chart-header">
      <span class="chart-title">Расход, л/100км</span>
      <div class="legend">
        <span class="legend-item"><i class="dot good" />лучше среднего</span>
        <span class="legend-item"><i class="dot bad" />хуже</span>
      </div>
    </div>

    <div class="chart-area">
      <div v-if="averagePct !== null" class="avg-line" :style="{ bottom: `${averagePct}%` }" />
      <button
        v-for="row in bars"
        :key="row.entry.id"
        class="bar-col"
        :aria-label="`${fmtDate(row.entry.date)}: ${row.litersPer100km?.toFixed(1)} л/100км`"
        @click="toggle(row.entry.id)"
      >
        <div
          class="bar"
          :class="[row.quality, { active: activeId === row.entry.id }]"
          :style="{ height: `${heightPct(row.litersPer100km)}%` }"
        />
      </button>
    </div>

    <div class="chart-footer">
      <span v-if="activeRow">
        {{ fmtDate(activeRow.entry.date) }} · {{ activeRow.litersPer100km?.toFixed(1) }} л/100км
      </span>
      <span v-else-if="average !== null" class="muted">В среднем {{ average.toFixed(1) }} л/100км</span>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
}

.legend {
  display: flex;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.dot.good {
  background: var(--green);
}

.dot.bad {
  background: var(--red);
}

.chart-area {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 100px;
}

.avg-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1.5px dashed var(--text-tertiary);
  opacity: 0.6;
}

.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  min-width: 0;
}

.bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: var(--text-tertiary);
  transition: opacity 0.15s ease;
}

.bar.good {
  background: var(--green);
}

.bar.bad {
  background: var(--red);
}

.bar-col:active .bar,
.bar.active {
  opacity: 0.6;
}

.chart-footer {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  min-height: 15px;
}

.chart-footer .muted {
  font-weight: 500;
  color: var(--text-secondary);
}
</style>
