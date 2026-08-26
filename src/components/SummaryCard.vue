<script setup lang="ts">
import { IonAvatar, IonCard, IonCardContent, IonChip, IonIcon, IonItem, IonLabel } from '@ionic/vue'
import { ellipse, water } from 'ionicons/icons'
import type { Car } from '../types'

defineProps<{
  car: Car
  okCount: number
  soonCount: number
  dueCount: number
  averageConsumption: number | null
}>()

const emit = defineEmits<{
  editMileage: []
  switchCar: []
}>()

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <ion-card color="primary" class="summary-card">
    <ion-item color="primary" lines="none" button detail @click="emit('switchCar')">
      <ion-avatar slot="start" class="car-avatar">{{ car.make.charAt(0).toUpperCase() }}</ion-avatar>
      <ion-label>{{ car.year }} · {{ car.make }} {{ car.model }}</ion-label>
    </ion-item>

    <ion-item color="primary" lines="none" button detail @click="emit('editMileage')">
      <ion-label>
        <p>Текущий пробег</p>
        <h1>{{ fmt(car.currentMileage) }} км</h1>
      </ion-label>
    </ion-item>

    <ion-card-content>
      <div class="chips">
        <ion-chip outline color="light">
          <ion-icon :icon="ellipse" color="success" />
          <ion-label>{{ okCount }} ок</ion-label>
        </ion-chip>
        <ion-chip v-if="soonCount > 0" outline color="light">
          <ion-icon :icon="ellipse" color="warning" />
          <ion-label>{{ soonCount }} скоро</ion-label>
        </ion-chip>
        <ion-chip v-if="dueCount > 0" outline color="light">
          <ion-icon :icon="ellipse" color="danger" />
          <ion-label>{{ dueCount }} просрочено</ion-label>
        </ion-chip>
        <ion-chip v-if="averageConsumption !== null" color="light">
          <ion-icon :icon="water" />
          <ion-label>{{ averageConsumption.toFixed(1) }} л/100км</ion-label>
        </ion-chip>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<style scoped>
.summary-card {
  margin: 16px;
}

.car-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.28);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
