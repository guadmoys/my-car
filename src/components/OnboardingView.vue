<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonList, IonNote, IonPage } from '@ionic/vue'
import { carSportOutline } from 'ionicons/icons'
import { CAR_MAKES, modelsForMake } from '../data/carCatalog'
import PickerSheet from './PickerSheet.vue'

const emit = defineEmits<{
  submit: [payload: { make: string; model: string; year: number; initialMileage: number }]
}>()

const make = ref('')
const model = ref('')
const year = ref<number>(new Date().getFullYear())
const mileage = ref<string>('')
const touched = ref(false)
const activePicker = ref<'make' | 'model' | null>(null)

const currentYear = new Date().getFullYear()

const mileageNumber = computed(() => Number(mileage.value.replace(/\s/g, '')))
const modelOptions = computed(() => modelsForMake(make.value))

function selectMake(value: string) {
  if (value !== make.value) model.value = ''
  make.value = value
}

const isValid = computed(() => {
  return (
    make.value.trim().length > 0 &&
    model.value.trim().length > 0 &&
    year.value >= 1950 &&
    year.value <= currentYear + 1 &&
    mileage.value.trim().length > 0 &&
    !Number.isNaN(mileageNumber.value) &&
    mileageNumber.value >= 0
  )
})

function handleSubmit() {
  touched.value = true
  if (!isValid.value) return
  emit('submit', {
    make: make.value.trim(),
    model: model.value.trim(),
    year: year.value,
    initialMileage: Math.round(mileageNumber.value),
  })
}
</script>

<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="onboarding">
        <div class="hero">
          <div class="glyph">
            <ion-icon :icon="carSportOutline" />
          </div>
          <h1>Моя машина</h1>
          <p>Учёт пробега и техобслуживания — всё офлайн, прямо на вашем устройстве</p>
        </div>

        <form @submit.prevent="handleSubmit">
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
              <ion-input
                v-model.number="year"
                label="Год выпуска"
                label-placement="stacked"
                type="number"
                inputmode="numeric"
                :min="1950"
                :max="currentYear + 1"
                placeholder="2020"
              />
            </ion-item>
            <ion-item lines="none">
              <ion-input
                v-model="mileage"
                label="Текущий пробег, км"
                label-placement="stacked"
                type="text"
                inputmode="numeric"
                placeholder="45000"
              />
            </ion-item>
          </ion-list>

          <ion-note v-if="touched && !isValid" color="danger" class="error">
            Заполните все поля корректно, чтобы продолжить
          </ion-note>

          <ion-button type="submit" expand="block" :disabled="touched && !isValid" class="submit">
            Начать
          </ion-button>
        </form>
      </div>

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
    </ion-content>
  </ion-page>
</template>

<style scoped>
.onboarding {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

.hero {
  text-align: center;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.glyph {
  width: 76px;
  height: 76px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(180deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  font-size: 40px;
  margin-bottom: 4px;
}

.hero h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.hero p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 15px;
  line-height: 1.4;
}

form {
  width: 100%;
  max-width: 400px;
}

.error {
  display: block;
  font-size: 13px;
  margin: 12px 16px 0;
  text-align: center;
}

.submit {
  margin: 20px 16px 16px;
}
</style>
