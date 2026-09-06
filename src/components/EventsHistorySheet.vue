<script setup lang="ts">
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
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { construct, water } from 'ionicons/icons'
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
      events: props.events.filter((e) => e.kind === kind),
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
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
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
    </ion-header>
    <ion-content>
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
          </ion-label>
        </ion-item>
      </ion-list>
      <ion-list v-if="groups.length === 0" inset>
        <ion-item>
          <ion-label color="medium">Пока нет событий</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
