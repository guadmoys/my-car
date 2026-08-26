<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonCard, IonCardContent } from '@ionic/vue'
import type { FuelConsumption } from '../types'

const props = defineProps<{
  history: FuelConsumption[]
  average: number | null
}>()

const activeId = ref<string | null>(null)

const W = 100
const H = 40
const PAD_TOP = 4
const PAD_BOTTOM = 4

const points = computed(() => {
  // props.history is newest-first, so take the 10 most recent entries
  // and reverse them to chronological order for left-to-right plotting.
  return props.history
    .filter((row) => row.litersPer100km !== null)
    .slice(0, 10)
    .reverse()
})

const domainMax = computed(() => {
  const values = points.value.map((p) => p.litersPer100km ?? 0)
  const avg = props.average ?? 0
  return Math.max(avg, ...values, 1) * 1.15
})

function xAt(i: number): number {
  const n = points.value.length
  return n <= 1 ? W / 2 : ((i + 0.5) / n) * W
}

function yAt(value: number): number {
  const usable = H - PAD_TOP - PAD_BOTTOM
  return PAD_TOP + (1 - value / domainMax.value) * usable
}

const coords = computed(() =>
  points.value.map((p, i) => ({ row: p, x: xAt(i), y: yAt(p.litersPer100km ?? 0) })),
)

const linePath = computed(() =>
  coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
)

const areaPath = computed(() => {
  if (coords.value.length === 0) return ''
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return `${linePath.value} L ${last.x.toFixed(1)},${H} L ${first.x.toFixed(1)},${H} Z`
})

const averageY = computed(() => (props.average !== null ? yAt(props.average) : null))

const activeRow = computed(() => points.value.find((p) => p.entry.id === activeId.value) ?? null)

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function toggle(id: string) {
  activeId.value = activeId.value === id ? null : id
}

function dotColor(quality: FuelConsumption['quality']): string {
  return quality === 'good'
    ? 'var(--ion-color-success)'
    : quality === 'bad'
      ? 'var(--ion-color-danger)'
      : 'var(--ion-color-medium)'
}
</script>

<template>
  <ion-card v-if="points.length > 0" class="chart-card">
    <ion-card-content>
    <div class="chart-header">
      <span class="chart-title">Расход, л/100км</span>
      <div class="legend">
        <span class="legend-item"><i class="dot good" />лучше среднего</span>
        <span class="legend-item"><i class="dot bad" />хуже</span>
      </div>
    </div>

    <div class="chart-area">
      <svg class="chart-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
        <defs>
          <linearGradient id="consumption-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--ion-color-primary)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--ion-color-primary)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line
          v-if="averageY !== null"
          class="avg-line"
          :x1="0"
          :x2="W"
          :y1="averageY"
          :y2="averageY"
        />
        <path :d="areaPath" fill="url(#consumption-area)" stroke="none" />
        <path :d="linePath" fill="none" stroke="var(--ion-color-primary)" stroke-width="1.6" vector-effect="non-scaling-stroke" />
        <circle
          v-for="c in coords"
          :key="c.row.entry.id"
          :cx="c.x"
          :cy="c.y"
          :r="c.row.entry.id === activeId ? 2.6 : 2"
          :fill="dotColor(c.row.quality)"
          stroke="var(--ion-card-background, #fff)"
          stroke-width="1"
        />
      </svg>
      <div class="hit-row">
        <button
          v-for="c in coords"
          :key="c.row.entry.id"
          class="hit"
          :aria-label="`${fmtDate(c.row.entry.date)}: ${c.row.litersPer100km?.toFixed(1)} л/100км`"
          @click="toggle(c.row.entry.id)"
        />
      </div>
    </div>

    <div class="chart-footer">
      <span v-if="activeRow">
        {{ fmtDate(activeRow.entry.date) }} · {{ activeRow.litersPer100km?.toFixed(1) }} л/100км
      </span>
      <span v-else-if="average !== null" class="muted">В среднем {{ average.toFixed(1) }} л/100км</span>
    </div>
    <p class="method-note">
      Расход считается между заправками «под пробку» — неполные заправки не искажают цифру, но
      сами не получают точного значения (если не указан остаток в баке)
    </p>
    </ion-card-content>
  </ion-card>
</template>

<style scoped>
.chart-card {
  margin: 0;
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
  color: var(--ion-color-medium);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.dot.good {
  background: var(--ion-color-success);
}

.dot.bad {
  background: var(--ion-color-danger);
}

.chart-area {
  position: relative;
  height: 100px;
}

.chart-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.avg-line {
  stroke: var(--ion-color-medium);
  stroke-width: 1;
  stroke-dasharray: 3 2;
  opacity: 0.7;
  vector-effect: non-scaling-stroke;
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

.chart-footer {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-text-color);
  text-align: center;
  min-height: 15px;
}

.chart-footer .muted {
  font-weight: 500;
  color: var(--ion-color-medium);
}

.method-note {
  margin: 8px 4px 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--ion-color-medium);
  text-align: center;
}
</style>
