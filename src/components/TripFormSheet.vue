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
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  type SegmentCustomEvent,
} from '@ionic/vue'

const props = defineProps<{
  currentMileage: number
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { startMileage: number; endMileage: number; purpose: 'business' | 'personal'; date?: number; note?: string }]
}>()

const startMileage = ref(String(props.currentMileage))
const endMileage = ref('')
const purpose = ref<'business' | 'personal'>('business')
const dateIso = ref(new Date().toISOString())
const note = ref('')
const maxDateIso = new Date().toISOString()

const startNumber = computed(() => Number(startMileage.value.replace(/\s/g, '')))
const endNumber = computed(() => Number(endMileage.value.replace(/\s/g, '')))

const isValid = computed(() => {
  if (startMileage.value.trim() === '' || Number.isNaN(startNumber.value) || startNumber.value < 0) return false
  if (endMileage.value.trim() === '' || Number.isNaN(endNumber.value)) return false
  return endNumber.value > startNumber.value
})

function selectPurpose(e: SegmentCustomEvent) {
  purpose.value = e.detail.value as 'business' | 'personal'
}

function handleSave() {
  if (!isValid.value) return
  emit('save', {
    startMileage: Math.round(startNumber.value),
    endMileage: Math.round(endNumber.value),
    purpose: purpose.value,
    date: new Date(dateIso.value).getTime(),
    note: note.value.trim() || undefined,
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
        <ion-title>Новая поездка</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="full">
          <ion-segment :value="purpose" @ionChange="selectPurpose">
            <ion-segment-button value="business"><ion-label>Деловая</ion-label></ion-segment-button>
            <ion-segment-button value="personal"><ion-label>Личная</ion-label></ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item>
          <ion-input v-model="startMileage" label="Пробег в начале, км" label-placement="stacked" inputmode="numeric" />
        </ion-item>
        <ion-item lines="none">
          <ion-input v-model="endMileage" label="Пробег в конце, км" label-placement="stacked" inputmode="numeric" />
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-item lines="none">
          <ion-label>Дата</ion-label>
          <ion-datetime-button slot="end" datetime="trip-date" />
        </ion-item>
      </ion-list>
      <ion-modal :keep-contents-mounted="true">
        <ion-datetime id="trip-date" v-model="dateIso" presentation="date" locale="ru-RU" :max="maxDateIso" />
      </ion-modal>

      <ion-list inset>
        <ion-item lines="none">
          <ion-input v-model="note" label="Цель поездки (необязательно)" label-placement="stacked" placeholder="—" />
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
