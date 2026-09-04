<script setup lang="ts">
import { ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { add, briefcaseOutline, personOutline } from 'ionicons/icons'
import type { Trip } from '../types'

defineProps<{
  trips: Trip[]
  totalBusinessKm: number
  totalPersonalKm: number
}>()

const emit = defineEmits<{
  close: []
  delete: [id: string]
  addTrip: []
}>()

const confirmingDeleteId = ref<string | null>(null)

function handleDeleteClick(id: string) {
  if (confirmingDeleteId.value !== id) {
    confirmingDeleteId.value = id
    return
  }
  emit('delete', id)
  confirmingDeleteId.value = null
}

function fmtKm(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function distance(trip: Trip): number {
  return Math.max(0, trip.endMileage - trip.startMileage)
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Поездки</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list v-if="trips.length > 0" inset>
        <ion-item>
          <ion-icon slot="start" :icon="briefcaseOutline" color="primary" />
          <ion-label>Деловые</ion-label>
          <ion-note slot="end">{{ fmtKm(totalBusinessKm) }} км</ion-note>
        </ion-item>
        <ion-item lines="none">
          <ion-icon slot="start" :icon="personOutline" color="medium" />
          <ion-label>Личные</ion-label>
          <ion-note slot="end">{{ fmtKm(totalPersonalKm) }} км</ion-note>
        </ion-item>
      </ion-list>
      <p v-if="trips.length > 0" class="hint">Для налогового учёта пробега — экспортируйте отчёт в PDF в Настройках</p>

      <ion-list inset>
        <ion-item v-for="t in trips" :key="t.id" lines="full">
          <ion-icon slot="start" :icon="t.purpose === 'business' ? briefcaseOutline : personOutline" :color="t.purpose === 'business' ? 'primary' : 'medium'" />
          <ion-label>
            <h2>{{ fmtKm(distance(t)) }} км · {{ t.purpose === 'business' ? 'Деловая' : 'Личная' }}</h2>
            <p>{{ fmtDate(t.date) }} · {{ fmtKm(t.startMileage) }}–{{ fmtKm(t.endMileage) }} км</p>
            <p v-if="t.note">{{ t.note }}</p>
          </ion-label>
          <ion-button
            slot="end"
            fill="clear"
            :color="confirmingDeleteId === t.id ? 'danger' : 'medium'"
            @click.stop="handleDeleteClick(t.id)"
          >
            {{ confirmingDeleteId === t.id ? 'Точно?' : 'Удалить' }}
          </ion-button>
        </ion-item>
        <ion-item v-if="trips.length === 0" lines="none">
          <ion-label color="medium">Поездок пока нет</ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" fill="outline" class="ion-margin" @click="emit('addTrip')">
        <ion-icon slot="start" :icon="add" />
        Добавить поездку
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 0 32px 12px;
}
</style>
