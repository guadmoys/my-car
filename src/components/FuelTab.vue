<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  type SegmentCustomEvent,
} from '@ionic/vue'
import { add, downloadOutline, ellipse, trash } from 'ionicons/icons'
import type { CostForecast, FuelConsumption, FuelInsight, HistoryEntry } from '../types'
import { haptic } from '../utils/haptics'
import ConsumptionChart from './ConsumptionChart.vue'
import MonthlySpendChart from './MonthlySpendChart.vue'
import StationPricesCard from './StationPricesCard.vue'
import { formatDate } from '../utils/dateFormat'

const props = defineProps<{
  fuelHistory: FuelConsumption[]
  historyEntries: HistoryEntry[]
  averageConsumption: number | null
  fuelInsights: FuelInsight[]
  totalFuelCost: number
  totalServiceCost: number
  totalCost: number
  totalCo2Kg: number
  hasAnyCost: boolean
  costForecast: { sixMonths: CostForecast | null; twelveMonths: CostForecast | null }
}>()

const fuelEntriesRaw = computed(() => props.fuelHistory.map((row) => row.entry))

const emit = defineEmits<{
  addFuel: []
  deleteFuel: [id: string]
  editCost: [id: string]
  exportCsv: []
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

function selectPeriod(event: SegmentCustomEvent) {
  const key = event.detail.value as Period
  if (period.value === key) return
  haptic('tap')
  period.value = key
}

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

function fmtCo2(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(2)} т` : `${Math.round(kg)} кг`
}

function qualityColor(quality: FuelConsumption['quality']): string | undefined {
  return quality === 'good' ? 'success' : quality === 'bad' ? 'danger' : 'medium'
}
</script>

<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>Расход</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content :fullscreen="true">
    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">Расход</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-list v-if="hasAnyCost" inset>
      <ion-list-header>Расходы</ion-list-header>
      <ion-item><ion-label>Топливо</ion-label><ion-note slot="end">{{ fmtCost(totalFuelCost) }}</ion-note></ion-item>
      <ion-item><ion-label>ТО</ion-label><ion-note slot="end">{{ fmtCost(totalServiceCost) }}</ion-note></ion-item>
      <ion-item>
        <ion-label><strong>Итого</strong></ion-label>
        <ion-note slot="end" color="primary"><strong>{{ fmtCost(totalCost) }}</strong></ion-note>
      </ion-item>
      <ion-item v-if="totalCo2Kg > 0" lines="none">
        <ion-label color="medium">Выбросы CO₂</ion-label>
        <ion-note slot="end">{{ fmtCo2(totalCo2Kg) }}</ion-note>
      </ion-item>
    </ion-list>

    <ion-list v-if="costForecast.sixMonths && costForecast.twelveMonths" inset>
      <ion-list-header>Прогноз расходов</ion-list-header>
      <ion-item>
        <ion-label>6 месяцев</ion-label>
        <ion-note slot="end" color="primary" class="ion-text-end">
          {{ fmtCost(costForecast.sixMonths.total) }}<br />
          <span class="forecast-breakdown">
            ⛽ {{ fmtCost(costForecast.sixMonths.fuel) }} · 🔧 {{ fmtCost(costForecast.sixMonths.maintenance) }}
          </span>
        </ion-note>
      </ion-item>
      <ion-item lines="none">
        <ion-label>12 месяцев</ion-label>
        <ion-note slot="end" color="primary" class="ion-text-end">
          {{ fmtCost(costForecast.twelveMonths.total) }}<br />
          <span class="forecast-breakdown">
            ⛽ {{ fmtCost(costForecast.twelveMonths.fuel) }} · 🔧 {{ fmtCost(costForecast.twelveMonths.maintenance) }}
          </span>
        </ion-note>
      </ion-item>
    </ion-list>
    <p v-if="costForecast.sixMonths" class="hint">
      Ориентировочно, по вашему текущему темпу трат на топливо и среднему чеку ТО — не бюджет
    </p>

    <div v-if="fuelHistory.length > 1 || hasAnyCost" class="charts-section">
      <ConsumptionChart :history="fuelHistory" :average="averageConsumption" />
      <MonthlySpendChart :fuel-entries="fuelEntriesRaw" :history-entries="historyEntries" />
    </div>

    <ion-list v-if="fuelInsights.length > 0" inset>
      <ion-list-header>Наблюдения</ion-list-header>
      <ion-item v-for="insight in fuelInsights" :key="insight.id" lines="none">
        <ion-label
          class="ion-text-wrap"
          :color="insight.tone === 'good' ? 'success' : insight.tone === 'bad' ? 'danger' : undefined"
        >
          {{ insight.icon }} {{ insight.text }}
        </ion-label>
      </ion-item>
    </ion-list>

    <StationPricesCard :fuel-entries="fuelEntriesRaw" />

    <ion-toolbar>
      <ion-segment :value="period" @ionChange="selectPeriod">
        <ion-segment-button v-for="p in PERIODS" :key="p.key" :value="p.key">
          <ion-label>{{ p.label }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-toolbar>

    <ion-list inset>
      <ion-list-header>Заправки</ion-list-header>
      <ion-item-sliding v-for="row in visible" :key="row.entry.id">
        <ion-item button :detail="false" @click="emit('editCost', row.entry.id)">
          <ion-icon slot="start" :icon="ellipse" :color="qualityColor(row.quality)" />
          <ion-label class="ion-text-wrap">
            <h2>
              {{ fmt(row.entry.liters) }} л
              <ion-note v-if="row.entry.fuelType">· {{ row.entry.fuelType }}</ion-note>
              <ion-note v-if="row.litersPer100km !== null">· {{ row.litersPer100km.toFixed(1) }} л/100км</ion-note>
              <ion-note v-else-if="row.entry.isFullTank === false">· неполный бак</ion-note>
              <ion-text v-if="row.entry.cost !== undefined" color="primary"> · {{ fmtCost(row.entry.cost) }}</ion-text>
            </h2>
            <p>
              {{ fmt(row.entry.mileage) }} км · {{ formatDate(row.entry.date) }}
              <template v-if="row.entry.station"> · {{ row.entry.station }}</template>
            </p>
            <p v-if="row.entry.comment">{{ row.entry.comment }}</p>
          </ion-label>
        </ion-item>
        <ion-item-options side="end">
          <ion-item-option color="danger" @click="emit('deleteFuel', row.entry.id)">
            <ion-icon slot="icon-only" :icon="trash" />
          </ion-item-option>
        </ion-item-options>
      </ion-item-sliding>
      <ion-item v-if="periodFiltered.length === 0">
        <ion-label color="medium">
          {{ fuelHistory.length === 0 ? 'Нет записей о заправках' : 'Нет записей за этот период' }}
        </ion-label>
      </ion-item>
      <ion-item v-if="periodFiltered.length > 8" button :detail="false" @click="showAll = !showAll">
        <ion-label color="primary" class="ion-text-center">
          {{ showAll ? 'Скрыть' : `Показать все (${periodFiltered.length})` }}
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-button v-if="fuelHistory.length > 0" expand="block" fill="outline" class="ion-margin" @click="emit('exportCsv')">
      <ion-icon slot="start" :icon="downloadOutline" />
      Экспорт в CSV
    </ion-button>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button @click="emit('addFuel')">
        <ion-icon :icon="add" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<style scoped>
.charts-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}

.forecast-breakdown {
  font-size: 12px;
}

.hint {
  font-size: 12px;
  color: var(--ion-color-medium);
  padding: 0 32px;
  margin-top: 4px;
}
</style>
