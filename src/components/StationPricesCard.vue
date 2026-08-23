<script setup lang="ts">
import { computed } from 'vue'
import type { FuelEntry } from '../types'

const props = defineProps<{
  fuelEntries: FuelEntry[]
}>()

interface StationStats {
  station: string
  count: number
  avgPrice: number
  trend: 'up' | 'down' | 'flat'
  points: { x: number; y: number }[]
}

const W = 60
const H = 20
const PAD = 2

const stations = computed<StationStats[]>(() => {
  const groups = new Map<string, { date: number; price: number }[]>()
  for (const e of props.fuelEntries) {
    if (!e.station || e.cost === undefined || e.liters <= 0) continue
    const arr = groups.get(e.station) ?? []
    arr.push({ date: e.date, price: e.cost / e.liters })
    groups.set(e.station, arr)
  }

  const result: StationStats[] = []
  for (const [station, entries] of groups) {
    if (entries.length < 2) continue
    const sorted = entries.slice().sort((a, b) => a.date - b.date)
    const prices = sorted.map((e) => e.price)
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length

    const last = prices[prices.length - 1]
    const prevAvg = prices.slice(0, -1).reduce((sum, p) => sum + p, 0) / (prices.length - 1)
    const trend: StationStats['trend'] =
      last > prevAvg * 1.02 ? 'up' : last < prevAvg * 0.98 ? 'down' : 'flat'

    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const span = max - min || 1
    const usable = H - PAD * 2
    const points = prices.map((p, i) => ({
      x: prices.length <= 1 ? W / 2 : (i / (prices.length - 1)) * W,
      y: PAD + (1 - (p - min) / span) * usable,
    }))

    result.push({ station, count: prices.length, avgPrice, trend, points })
  }

  return result.sort((a, b) => a.avgPrice - b.avgPrice)
})

function pathFor(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}
</script>

<template>
  <section v-if="stations.length > 0" class="section">
    <div class="section-title">Цены по АЗС</div>
    <div class="card stations-card">
      <div v-for="s in stations" :key="s.station" class="station-row">
        <div class="station-info">
          <div class="station-name">{{ s.station }}</div>
          <div class="station-meta">{{ s.count }} заправ{{ s.count === 1 ? 'ка' : 'ки' }}</div>
        </div>
        <svg class="sparkline" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
          <path :d="pathFor(s.points)" fill="none" stroke="var(--blue)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>
        <div class="station-price">
          <span class="price-value">{{ s.avgPrice.toFixed(1) }} ₽/л</span>
          <span
            v-if="s.trend !== 'flat'"
            class="price-trend"
            :class="s.trend === 'up' ? 'bad' : 'good'"
          >{{ s.trend === 'up' ? '▲' : '▼' }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
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
  border-radius: var(--radius-lg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.stations-card {
  padding: 4px 16px;
}

.station-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--separator);
}

.station-row:last-child {
  border-bottom: none;
}

.station-info {
  flex: 1;
  min-width: 0;
}

.station-name {
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.station-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.sparkline {
  width: 60px;
  height: 20px;
  flex-shrink: 0;
}

.station-price {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.price-trend {
  font-size: 11px;
}

.price-trend.good {
  color: var(--green);
}

.price-trend.bad {
  color: var(--red);
}
</style>
