<script setup lang="ts">
import { formatMoney } from '../utils/currency'
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { construct, searchOutline, water } from 'ionicons/icons'
import type { TimelineEvent } from '../types'

const props = defineProps<{
  events: TimelineEvent[]
}>()

const emit = defineEmits<{
  close: []
}>()

type EventFilter = 'all' | TimelineEvent['kind']

const CATEGORY_LABELS: Record<TimelineEvent['kind'], string> = {
  fuel: 'Заправки',
  service: 'ТО',
}

const filter = ref<EventFilter>('all')
const query = ref('')

type Period = 'all' | '30' | '90' | 'year'
const period = ref<Period>('all')

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: 'За всё время' },
  { value: '30', label: 'Последние 30 дней' },
  { value: '90', label: 'Последние 90 дней' },
  { value: 'year', label: 'Этот год' },
]

function periodStart(p: Period): number {
  const now = new Date()
  if (p === '30') return now.getTime() - 30 * 86400000
  if (p === '90') return now.getTime() - 90 * 86400000
  if (p === 'year') return new Date(now.getFullYear(), 0, 1).getTime()
  return 0
}

function searchText(e: TimelineEvent): string {
  const parts: (string | number | undefined)[] =
    e.kind === 'fuel'
      ? [e.entry.station, e.entry.comment, e.entry.fuelType, 'заправка']
      : [e.entry.itemName, e.entry.note, 'то']
  parts.push(e.mileage, e.entry.cost)
  return parts.filter((p) => p !== undefined).join(' ').toLowerCase()
}

const filteredEvents = computed(() => {
  const q = query.value.trim().toLowerCase()
  const from = periodStart(period.value)
  return props.events.filter((e) => e.date >= from && (!q || searchText(e).includes(q)))
})

const fuelCount = computed(() => props.events.filter((e) => e.kind === 'fuel').length)
const serviceCount = computed(() => props.events.filter((e) => e.kind === 'service').length)

interface EventGroup {
  kind: TimelineEvent['kind']
  label: string
  events: TimelineEvent[]
}

const groups = computed<EventGroup[]>(() => {
  const kinds: TimelineEvent['kind'][] = filter.value === 'all' ? ['fuel', 'service'] : [filter.value]
  return kinds
    .map((kind) => ({
      kind,
      label: CATEGORY_LABELS[kind],
      events: filteredEvents.value.filter((e) => e.kind === kind),
    }))
    .filter((group) => group.events.length > 0)
})

function eventIcon(event: TimelineEvent): string {
  return event.kind === 'fuel' ? water : construct
}

function eventTitle(event: TimelineEvent): string {
  if (event.kind === 'fuel') return `Заправка · ${fmt(event.entry.liters)} л`
  return event.entry.itemName
}

function eventMeta(event: TimelineEvent): string {
  const parts = [fmt(event.mileage) + ' км', fmtDate(event.date)]
  if (event.entry.cost !== undefined) parts.push(fmtCost(event.entry.cost))
  return parts.join(' · ')
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtCost(n: number): string {
  return formatMoney(n)
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Все события</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="filter">
          <ion-segment-button value="all">
            <ion-label>Все</ion-label>
          </ion-segment-button>
          <ion-segment-button value="fuel" :disabled="fuelCount === 0">
            <ion-label>Заправки</ion-label>
          </ion-segment-button>
          <ion-segment-button value="service" :disabled="serviceCount === 0">
            <ion-label>ТО</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="query" placeholder="Поиск: АЗС, работа, заметка" :debounce="200" />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="none">
          <ion-select v-model="period" label="Период" interface="action-sheet" :interface-options="{ cancelText: 'Отмена' }">
            <ion-select-option v-for="o in PERIOD_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>
      <ion-list v-for="group in groups" :key="group.kind" inset>
        <ion-list-header v-if="filter === 'all'">
          <ion-label>{{ group.label }}</ion-label>
          <ion-note>{{ group.events.length }}</ion-note>
        </ion-list-header>
        <ion-item v-for="event in group.events" :key="`${event.kind}-${event.id}`">
          <ion-icon slot="start" :icon="eventIcon(event)" />
          <ion-label>
            <h2>{{ eventTitle(event) }}</h2>
            <p>{{ eventMeta(event) }}</p>
            <p v-if="event.kind === 'service' && event.entry.note" class="event-note">{{ event.entry.note }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
      <ion-list v-if="groups.length === 0" inset>
        <ion-item>
          <ion-icon slot="start" :icon="searchOutline" color="medium" />
          <ion-label color="medium">{{ events.length === 0 ? 'Пока нет событий' : 'Ничего не найдено — измените запрос или период' }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.event-note {
  white-space: pre-line;
}
</style>
