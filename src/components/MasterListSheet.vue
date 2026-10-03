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
import { add } from 'ionicons/icons'
import type { Master } from '../types'
import type { MasterStats } from '../utils/masterStats'
import { formatMoney } from '../utils/currency'

defineProps<{
  masters: Master[]
  stats?: Map<string, MasterStats>
}>()

const emit = defineEmits<{
  close: []
  edit: [master: Master]
  delete: [id: string]
  addMaster: []
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

function subtitle(m: Master): string {
  return [m.specialty, m.phone].filter(Boolean).join(' · ') || '—'
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Проверенные мастера</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item v-for="m in masters" :key="m.id" button :detail="false" @click="emit('edit', m)">
          <ion-avatar slot="start" class="master-avatar">{{ m.name.charAt(0).toUpperCase() }}</ion-avatar>
          <ion-label>
            <h2>{{ m.name }}</h2>
            <p>{{ subtitle(m) }}</p>
            <p v-if="stats?.get(m.id)">
              Визитов: {{ stats.get(m.id)!.count }} · потрачено {{ formatMoney(stats.get(m.id)!.total) }}<template v-if="stats.get(m.id)!.laborCount > 0"> · работа в среднем {{ formatMoney(stats.get(m.id)!.labor / stats.get(m.id)!.laborCount) }}</template>
            </p>
          </ion-label>
          <ion-button
            slot="end"
            fill="clear"
            :color="confirmingDeleteId === m.id ? 'danger' : 'medium'"
            @click.stop="handleDeleteClick(m.id)"
          >
            {{ confirmingDeleteId === m.id ? 'Точно?' : 'Удалить' }}
          </ion-button>
        </ion-item>
        <ion-item v-if="masters.length === 0" lines="none">
          <ion-label color="medium">Мастеров пока нет</ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" fill="outline" class="ion-margin" @click="emit('addMaster')">
        <ion-icon slot="start" :icon="add" />
        Добавить мастера
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.master-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--ion-color-tertiary), var(--ion-color-tertiary-shade));
}
</style>
