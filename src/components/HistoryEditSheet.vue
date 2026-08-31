<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import type { HistoryEntry } from '../types'

const props = defineProps<{
  entry: HistoryEntry
  currentMileage: number
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { itemName: string; mileage: number; date: number; cost?: number }]
}>()

const itemName = ref(props.entry.itemName)
const mileage = ref(String(props.entry.mileage))
const cost = ref(props.entry.cost !== undefined ? String(props.entry.cost) : '')
const dateIso = ref(new Date(props.entry.date).toISOString())
const maxDateIso = new Date().toISOString()

const mileageNumber = computed(() => Number(mileage.value.replace(/\s/g, '').replace(',', '.')))
const costNumber = computed(() => Number(cost.value.replace(/\s/g, '').replace(',', '.')))

const isValid = computed(() => {
  if (!itemName.value.trim()) return false
  if (
    mileage.value.trim() === '' ||
    Number.isNaN(mileageNumber.value) ||
    mileageNumber.value < 0 ||
    mileageNumber.value > props.currentMileage
  ) {
    return false
  }
  if (cost.value.trim() !== '' && (Number.isNaN(costNumber.value) || costNumber.value < 0)) return false
  return true
})

function handleSave() {
  if (!isValid.value) return
  emit('save', {
    itemName: itemName.value.trim(),
    mileage: Math.round(mileageNumber.value),
    date: new Date(dateIso.value).getTime(),
    cost: cost.value.trim() === '' ? undefined : costNumber.value,
  })
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>Изменить ТО</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item>
          <ion-input v-model="itemName" label="Название" label-placement="stacked" placeholder="Например, Замена масла" />
        </ion-item>
        <ion-item lines="none">
          <ion-label>Дата</ion-label>
          <ion-datetime-button slot="end" datetime="history-entry-date" />
        </ion-item>
      </ion-list>
      <ion-modal :keep-contents-mounted="true">
        <ion-datetime id="history-entry-date" v-model="dateIso" presentation="date" locale="ru-RU" :max="maxDateIso" />
      </ion-modal>

      <ion-list inset>
        <ion-item>
          <ion-input v-model="mileage" label="Пробег, км" label-placement="stacked" inputmode="numeric" />
        </ion-item>
        <ion-item lines="none">
          <ion-input v-model="cost" label="Стоимость, ₽ (необязательно)" label-placement="stacked" inputmode="decimal" placeholder="—" />
        </ion-item>
      </ion-list>
      <ion-note v-if="mileageNumber > currentMileage" color="danger" class="hint">
        Не может быть больше текущего пробега машины ({{ Math.round(currentMileage).toLocaleString('ru-RU') }} км)
      </ion-note>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint {
  display: block;
  font-size: 12px;
  margin: 6px 32px;
}
</style>
