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
import { construct, searchOutline, walletOutline, water } from 'ionicons/icons'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_ITEM_KIND_LABELS, type TimelineEvent } from '../types'

const props = defineProps<{
  events: TimelineEvent[]
}>()

const emit = defineEmits<{
  close: []
}>()

type EventFilter = 'all' | TimelineEvent['kind']

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
  const parts: (string | number | null | undefined)[] = [e.mileage]
  if (e.kind === 'fuel') parts.push(e.entry.station, e.entry.comment, e.entry.fuelType, 'заправка', e.entry.cost)
  else if (e.kind === 'service') parts.push(e.entry.itemName, e.entry.note, 'то', e.entry.cost)
  else {
    parts.push(e.entry.title, EXPENSE_CATEGORY_LABELS[e.entry.category], e.entry.note, 'расход', e.entry.amount)
    for (const item of e.entry.items ?? []) parts.push(item.name)
  }
  if (e.kind === 'service') for (const item of e.entry.items ?? []) parts.push(item.name)
  return parts.filter((p) => p !== undefined && p !== null).join(' ').toLowerCase()
}

const filteredEvents = computed(() => {
  const q = query.value.trim().toLowerCase()
  const from = periodStart(period.value)
  return props.events.filter(
    (e) => (filter.value === 'all' || e.kind === filter.value) && e.date >= from && (!q || searchText(e).includes(q)),
  )
})

const fuelCount = computed(() => props.events.filter((e) => e.kind === 'fuel').length)
const serviceCount = computed(() => props.events.filter((e) => e.kind === 'service').length)
const expenseCount = computed(() => props.events.filter((e) => e.kind === 'expense').length)

interface MonthGroup {
  key: string
  label: string
  events: TimelineEvent[]
}

/** One chronological feed (newest first), split only by month headers. */
const months = computed<MonthGroup[]>(() => {
  const sorted = [...filteredEvents.value].sort((a, b) => b.date - a.date)
  const result: MonthGroup[] = []
  for (const event of sorted) {
    const d = new Date(event.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let group = result[result.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }), events: [] }
      result.push(group)
    }
    group.events.push(event)
  }
  return result
})

function eventIcon(event: TimelineEvent): string {
  if (event.kind === 'expense') return walletOutline
  return event.kind === 'fuel' ? water : construct
}

function eventTitle(event: TimelineEvent): string {
  if (event.kind === 'fuel') return `Заправка · ${fmt(event.entry.liters)} л`
  if (event.kind === 'expense') return event.entry.title || EXPENSE_CATEGORY_LABELS[event.entry.category]
  return event.entry.itemName
}

function eventCost(event: TimelineEvent): number | undefined {
  return event.kind === 'expense' ? event.entry.amount : event.entry.cost
}

function eventMeta(event: TimelineEvent): string {
  const parts = event.mileage === null ? [fmtDate(event.date)] : [fmt(event.mileage) + ' км', fmtDate(event.date)]
  if (event.kind === 'expense') parts.push(EXPENSE_CATEGORY_LABELS[event.entry.category])
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
          <ion-segment-button value="expense" :disabled="expenseCount === 0">
            <ion-label>Прочее</ion-label>
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
      <ion-list v-for="month in months" :key="month.key" inset>
        <ion-list-header>
          <ion-label class="month-label">{{ month.label }}</ion-label>
          <ion-note>{{ month.events.length }}</ion-note>
        </ion-list-header>
        <ion-item v-for="event in month.events" :key="`${event.kind}-${event.id}`">
          <ion-icon slot="start" :icon="eventIcon(event)" />
          <ion-label class="ion-text-wrap">
            <h2>{{ eventTitle(event) }}</h2>
            <p>{{ eventMeta(event) }}</p>
            <template v-if="event.kind !== 'fuel' && event.entry.items?.length">
              <p v-for="item in event.entry.items" :key="item.id">
                {{ EXPENSE_ITEM_KIND_LABELS[item.kind] }}: {{ item.name }} — {{ fmtCost(item.amount) }}
              </p>
            </template>
            <p v-if="event.kind === 'service' && event.entry.note" class="event-note">{{ event.entry.note }}</p>
            <p v-if="event.kind === 'expense' && event.entry.note" class="event-note">{{ event.entry.note }}</p>
          </ion-label>
          <ion-note v-if="eventCost(event) !== undefined" slot="end">{{ fmtCost(eventCost(event) as number) }}</ion-note>
        </ion-item>
      </ion-list>
      <ion-list v-if="months.length === 0" inset>
        <ion-item>
          <ion-icon slot="start" :icon="searchOutline" color="medium" />
          <ion-label color="medium">{{ events.length === 0 ? 'Пока нет событий' : 'Ничего не найдено — измените запрос или период' }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.month-label {
  text-transform: capitalize;
}

.event-note {
  white-space: pre-line;
}
</style>
