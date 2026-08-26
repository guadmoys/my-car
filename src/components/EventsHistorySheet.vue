<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonModal, IonTitle, IonToolbar } from '@ionic/vue'
import { construct, water } from 'ionicons/icons'
import type { TimelineEvent } from '../types'

defineProps<{
  events: TimelineEvent[]
}>()

const emit = defineEmits<{
  close: []
}>()

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
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item v-for="event in events" :key="`${event.kind}-${event.id}`">
          <ion-icon slot="start" :icon="eventIcon(event)" />
          <ion-label>
            <h2>{{ eventTitle(event) }}</h2>
            <p>{{ eventMeta(event) }}</p>
          </ion-label>
        </ion-item>
        <ion-item v-if="events.length === 0">
          <ion-label color="medium">Пока нет событий</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
