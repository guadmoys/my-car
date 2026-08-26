<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/vue'
import { caretDown, caretUp } from 'ionicons/icons'
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
  <ion-list v-if="stations.length > 0" inset>
    <ion-list-header>Цены по АЗС</ion-list-header>
    <ion-item v-for="s in stations" :key="s.station" lines="inset">
      <ion-label>
        <h2>{{ s.station }}</h2>
        <p>{{ s.count }} заправ{{ s.count === 1 ? 'ка' : 'ки' }}</p>
      </ion-label>
      <svg class="sparkline" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
        <path
          :d="pathFor(s.points)"
          fill="none"
          stroke="var(--ion-color-primary)"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <div slot="end" class="station-price">
        <ion-note>{{ s.avgPrice.toFixed(1) }} ₽/л</ion-note>
        <ion-icon v-if="s.trend === 'up'" :icon="caretUp" color="danger" />
        <ion-icon v-if="s.trend === 'down'" :icon="caretDown" color="success" />
      </div>
    </ion-item>
  </ion-list>
</template>

<style scoped>
.sparkline {
  width: 60px;
  height: 20px;
  flex-shrink: 0;
  margin: 0 12px;
}

.station-price {
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
</style>
