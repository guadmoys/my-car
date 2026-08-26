<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
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
import { CAR_MAKES, modelsForMake } from '../data/carCatalog'
import PickerSheet from './PickerSheet.vue'

const emit = defineEmits<{
  close: []
  create: [payload: { make: string; model: string; year: number; initialMileage: number }]
}>()

const make = ref('')
const model = ref('')
const year = ref(String(new Date().getFullYear()))
const mileage = ref('')
const activePicker = ref<'make' | 'model' | null>(null)

const currentYear = new Date().getFullYear()
const mileageNumber = computed(() => Number(mileage.value.replace(/\s/g, '')))
const yearNumber = computed(() => Number(year.value))
const modelOptions = computed(() => modelsForMake(make.value))

function selectMake(value: string) {
  if (value !== make.value) model.value = ''
  make.value = value
}

const isValid = computed(() => {
  return (
    make.value.trim().length > 0 &&
    model.value.trim().length > 0 &&
    yearNumber.value >= 1950 &&
    yearNumber.value <= currentYear + 1 &&
    mileage.value.trim().length > 0 &&
    !Number.isNaN(mileageNumber.value) &&
    mileageNumber.value >= 0
  )
})

function handleSave() {
  if (!isValid.value) return
  emit('create', {
    make: make.value.trim(),
    model: model.value.trim(),
    year: yearNumber.value,
    initialMileage: Math.round(mileageNumber.value),
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
        <ion-title>Новая машина</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item button detail @click="activePicker = 'make'">
          <ion-label>Марка</ion-label>
          <ion-note slot="end">{{ make || 'Выбрать' }}</ion-note>
        </ion-item>
        <ion-item button detail :disabled="!make" @click="activePicker = 'model'">
          <ion-label>Модель</ion-label>
          <ion-note slot="end">{{ model || (make ? 'Выбрать' : 'Сначала выберите марку') }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-input v-model="year" label="Год выпуска" label-placement="stacked" inputmode="numeric" placeholder="2020" />
        </ion-item>
        <ion-item lines="none">
          <ion-input v-model="mileage" label="Текущий пробег, км" label-placement="stacked" inputmode="numeric" placeholder="45000" />
        </ion-item>
      </ion-list>
    </ion-content>

    <PickerSheet
      v-if="activePicker === 'make'"
      title="Марка"
      :items="CAR_MAKES"
      :selected="make"
      placeholder="Поиск марки"
      custom-label="Своя марка"
      @close="activePicker = null"
      @select="selectMake"
    />
    <PickerSheet
      v-if="activePicker === 'model'"
      title="Модель"
      :items="modelOptions"
      :selected="model"
      placeholder="Поиск модели"
      custom-label="Своя модель"
      @close="activePicker = null"
      @select="(value) => (model = value)"
    />
  </ion-modal>
</template>
