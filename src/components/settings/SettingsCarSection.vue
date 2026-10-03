<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/vue'
import {
  barcodeOutline,
  buildOutline,
  calendarOutline,
  carOutline,
  carSportOutline,
  cashOutline,
  documentTextOutline,
  folderOutline,
  mapOutline,
  peopleOutline,
  pricetagOutline,
  speedometerOutline,
  waterOutline,
} from 'ionicons/icons'
import type { Car } from '../../types'
import { CAR_MAKES, modelsForMake } from '../../data/carCatalog'
import PickerSheet from '../PickerSheet.vue'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'

const props = defineProps<{
  car: Car
  carCount: number
  masterCount: number
  expenseCount: number
  documentCount: number
  tripCount: number
}>()

const emit = defineEmits<{
  save: [
    payload: {
      make: string
      model: string
      year: number
      tankCapacity?: number
      vin?: string
      licensePlate?: string
      referenceConsumptionL100km?: number
    },
  ]
  openCarSwitcher: []
  openMasters: []
  openExpenses: []
  openComponents: []
  openTrips: []
  openDocuments: []
  sharePassport: []
}>()

const make = ref(props.car.make)
const model = ref(props.car.model)
const year = ref(String(props.car.year))
const tankCapacity = ref(props.car.tankCapacity !== undefined ? String(props.car.tankCapacity) : '')
const vin = ref(props.car.vin ?? '')
const licensePlate = ref(props.car.licensePlate ?? '')
const referenceConsumption = ref(props.car.referenceConsumptionL100km !== undefined ? String(props.car.referenceConsumptionL100km) : '')
const activePicker = ref<'make' | 'model' | null>(null)
const modelOptions = computed(() => modelsForMake(make.value))

watch(
  () => props.car.id,
  () => {
    make.value = props.car.make
    model.value = props.car.model
    year.value = String(props.car.year)
    tankCapacity.value = props.car.tankCapacity !== undefined ? String(props.car.tankCapacity) : ''
    vin.value = props.car.vin ?? ''
    licensePlate.value = props.car.licensePlate ?? ''
    referenceConsumption.value = props.car.referenceConsumptionL100km !== undefined ? String(props.car.referenceConsumptionL100km) : ''
  },
)

function selectMake(value: string) {
  if (value !== make.value) model.value = ''
  make.value = value
  commitCarInfo()
}

function selectModel(value: string) {
  model.value = value
  commitCarInfo()
}

function commitCarInfo() {
  const y = Number(year.value)
  if (!make.value.trim() || !model.value.trim() || Number.isNaN(y)) return

  const capacityTrimmed = tankCapacity.value.trim().replace(',', '.')
  const capacityNumber = capacityTrimmed === '' ? undefined : Number(capacityTrimmed)
  if (capacityNumber !== undefined && (Number.isNaN(capacityNumber) || capacityNumber < 0)) return

  const referenceTrimmed = referenceConsumption.value.trim().replace(',', '.')
  const referenceNumber = referenceTrimmed === '' ? undefined : Number(referenceTrimmed)
  if (referenceNumber !== undefined && (Number.isNaN(referenceNumber) || referenceNumber < 0)) return

  const vinTrimmed = vin.value.trim() || undefined
  const plateTrimmed = licensePlate.value.trim() || undefined

  if (
    make.value.trim() === props.car.make &&
    model.value.trim() === props.car.model &&
    y === props.car.year &&
    capacityNumber === props.car.tankCapacity &&
    vinTrimmed === props.car.vin &&
    plateTrimmed === props.car.licensePlate &&
    referenceNumber === props.car.referenceConsumptionL100km
  ) {
    return
  }
  emit('save', {
    make: make.value.trim(),
    model: model.value.trim(),
    year: y,
    tankCapacity: capacityNumber,
    vin: vinTrimmed,
    licensePlate: plateTrimmed,
    referenceConsumptionL100km: referenceNumber,
  })
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>
      <ion-label>Автомобиль</ion-label>
      <HintButton
        text="Зная объём бака, можно точно считать расход и по неполным заправкам — если отмечать остаток в баке. Не знаете точное значение — посмотрите в ПТС, руководстве по эксплуатации или на крышке бензобака. Ориентировочно: седаны и хэтчбеки — 40–55 л, кроссоверы — 55–65 л, крупные внедорожники — 70–95 л."
      />
    </ion-list-header>
    <ion-item button detail @click="activePicker = 'make'">
      <SettingsIconBadge slot="start" :icon="carSportOutline" color="primary" />
      <ion-label>Марка</ion-label>
      <ion-note slot="end">{{ make || 'Выбрать' }}</ion-note>
    </ion-item>
    <ion-item button detail :disabled="!make" @click="activePicker = 'model'">
      <SettingsIconBadge slot="start" :icon="carSportOutline" color="primary" />
      <ion-label>Модель</ion-label>
      <ion-note slot="end">{{ model || (make ? 'Выбрать' : 'Сначала выберите марку') }}</ion-note>
    </ion-item>
    <ion-item>
      <SettingsIconBadge slot="start" :icon="calendarOutline" color="tertiary" />
      <ion-input
        v-model="year"
        label="Год выпуска"
        label-placement="stacked"
        enterkeyhint="next" inputmode="numeric"
        @ion-blur="commitCarInfo"
      />
    </ion-item>
    <ion-item>
      <SettingsIconBadge slot="start" :icon="waterOutline" color="secondary" />
      <ion-input
        v-model="tankCapacity"
        label="Объём бака, л (необязательно)"
        label-placement="stacked"
        enterkeyhint="next" inputmode="decimal"
        placeholder="—"
        @ion-blur="commitCarInfo"
      />
    </ion-item>
    <ion-item>
      <SettingsIconBadge slot="start" :icon="speedometerOutline" color="secondary" />
      <ion-input
        v-model="referenceConsumption"
        label="Паспортный расход, л/100км (необязательно)"
        label-placement="stacked"
        enterkeyhint="next" inputmode="decimal"
        placeholder="—"
        @ion-blur="commitCarInfo"
      />
    </ion-item>
    <ion-item>
      <SettingsIconBadge slot="start" :icon="barcodeOutline" color="medium" />
      <ion-input v-model="vin" label="VIN (необязательно)" label-placement="stacked" placeholder="—" @ion-blur="commitCarInfo" />
    </ion-item>
    <ion-item lines="none">
      <SettingsIconBadge slot="start" :icon="pricetagOutline" color="medium" />
      <ion-input
        v-model="licensePlate"
        label="Госномер (необязательно)"
        label-placement="stacked"
        placeholder="—"
        @ion-blur="commitCarInfo"
      />
    </ion-item>
  </ion-list>

  <ion-list inset>
    <ion-item button detail @click="emit('openCarSwitcher')">
      <SettingsIconBadge slot="start" :icon="carOutline" color="success" />
      <ion-label>Мои машины ({{ carCount }})</ion-label>
    </ion-item>
    <ion-item button detail @click="emit('openDocuments')">
      <SettingsIconBadge slot="start" :icon="folderOutline" color="primary" />
      <ion-label>Документы ({{ documentCount }})</ion-label>
    </ion-item>
    <ion-item button detail @click="emit('openMasters')">
      <SettingsIconBadge slot="start" :icon="peopleOutline" color="tertiary" />
      <ion-label>Проверенные мастера ({{ masterCount }})</ion-label>
    </ion-item>
    <ion-item button detail @click="emit('openExpenses')">
      <SettingsIconBadge slot="start" :icon="cashOutline" color="warning" />
      <ion-label>Прочие расходы ({{ expenseCount }})</ion-label>
    </ion-item>
    <ion-item button detail @click="emit('openComponents')">
      <SettingsIconBadge slot="start" :icon="buildOutline" color="dark" />
      <ion-label>Компоненты (шины, АКБ, колодки)</ion-label>
    </ion-item>
    <ion-item button detail @click="emit('openTrips')">
      <SettingsIconBadge slot="start" :icon="mapOutline" color="secondary" />
      <ion-label>Поездки ({{ tripCount }})</ion-label>
    </ion-item>
    <ion-item button detail lines="none" @click="emit('sharePassport')">
      <SettingsIconBadge slot="start" :icon="documentTextOutline" color="primary" />
      <ion-label>Поделиться паспортом машины</ion-label>
    </ion-item>
  </ion-list>

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
    @select="selectModel"
  />
</template>
