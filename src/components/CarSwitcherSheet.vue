<script setup lang="ts">
import { ref } from 'vue'
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { add, checkmark } from 'ionicons/icons'
import type { Car } from '../types'

const props = defineProps<{
  cars: Car[]
  activeCarId: string
}>()

const emit = defineEmits<{
  close: []
  switch: [id: string]
  delete: [id: string]
  addCar: []
}>()

const confirmingDeleteId = ref<string | null>(null)

function handleSelect(id: string) {
  if (id === props.activeCarId) {
    emit('close')
    return
  }
  emit('switch', id)
  emit('close')
}

function handleDeleteClick(id: string) {
  if (confirmingDeleteId.value !== id) {
    confirmingDeleteId.value = id
    return
  }
  emit('delete', id)
  confirmingDeleteId.value = null
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Мои машины</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item v-for="c in cars" :key="c.id" button :detail="false" @click="handleSelect(c.id)">
          <ion-icon v-if="c.id === activeCarId" slot="start" :icon="checkmark" color="primary" />
          <ion-avatar slot="start" class="car-avatar">{{ c.make.charAt(0).toUpperCase() }}</ion-avatar>
          <ion-label>
            <h2>{{ c.year }} · {{ c.make }} {{ c.model }}</h2>
            <p>{{ fmt(c.currentMileage) }} км</p>
          </ion-label>
          <ion-button
            slot="end"
            fill="clear"
            :color="confirmingDeleteId === c.id ? 'danger' : 'medium'"
            @click.stop="handleDeleteClick(c.id)"
          >
            {{ confirmingDeleteId === c.id ? 'Точно?' : 'Удалить' }}
          </ion-button>
        </ion-item>
      </ion-list>

      <ion-button expand="block" fill="outline" class="ion-margin" @click="emit('addCar')">
        <ion-icon slot="start" :icon="add" />
        Добавить машину
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.car-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
}
</style>
