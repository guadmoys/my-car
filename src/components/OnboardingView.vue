<script setup lang="ts">
import { computed, ref } from 'vue'
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
  <div class="onboarding">
    <div class="hero">
      <div class="glyph">
        <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
          <path
            d="M6 26 L9.5 15.5C10.7 11.9 14 9.5 17.8 9.5H30.2C34 9.5 37.3 11.9 38.5 15.5L42 26"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect x="4" y="26" width="40" height="12" rx="4" stroke="currentColor" stroke-width="2.6" />
          <circle cx="14" cy="38" r="3.4" fill="currentColor" />
          <circle cx="34" cy="38" r="3.4" fill="currentColor" />
        </svg>
      </div>
      <h1>Моя машина</h1>
      <p>Учёт пробега и техобслуживания — всё офлайн, прямо на вашем устройстве</p>
    </div>

    <form class="card" @submit.prevent="handleSubmit">
      <button type="button" class="field picker-field" @click="activePicker = 'make'">
        <label>Марка</label>
        <span class="picker-value" :class="{ placeholder: !make }">{{ make || 'Выбрать' }}</span>
      </button>
      <div class="divider" />
      <button
        type="button"
        class="field picker-field"
        :class="{ disabled: !make }"
        @click="make && (activePicker = 'model')"
      >
        <label>Модель</label>
        <span class="picker-value" :class="{ placeholder: !model }">
          {{ model || (make ? 'Выбрать' : 'Сначала выберите марку') }}
        </span>
      </button>
      <div class="divider" />
      <div class="field">
        <label for="year">Год выпуска</label>
        <input
          id="year"
          v-model.number="year"
          type="number"
          inputmode="numeric"
          :min="1950"
          :max="currentYear + 1"
          placeholder="2020"
        />
      </div>
      <div class="divider" />
      <div class="field">
        <label for="mileage">Текущий пробег, км</label>
        <input
          id="mileage"
          v-model="mileage"
          type="text"
          inputmode="numeric"
          placeholder="45000"
        />
      </div>

      <p v-if="touched && !isValid" class="error">
        Заполните все поля корректно, чтобы продолжить
      </p>

      <button type="submit" class="submit" :class="{ disabled: !isValid }">
        Начать
      </button>
    </form>

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
  </div>
</template>

<style scoped>
.onboarding {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(24px + var(--safe-top)) 20px calc(24px + var(--safe-bottom));
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
  background: linear-gradient(180deg, var(--blue), #0040dd);
  box-shadow: var(--shadow);
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
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.4;
}

.card {
  width: 100%;
  max-width: 400px;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  padding: 4px 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 0;
}

.field label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.field input {
  border: none;
  background: transparent;
  font-size: 17px;
  color: var(--text);
  padding: 2px 0;
  outline: none;
}

.field input::placeholder {
  color: var(--text-tertiary);
}

.picker-field {
  width: 100%;
  text-align: left;
  align-items: flex-start;
}

.picker-field.disabled {
  opacity: 0.5;
}

.picker-value {
  font-size: 17px;
  color: var(--text);
  padding: 2px 0;
}

.picker-value.placeholder {
  color: var(--text-tertiary);
}

.divider {
  height: 1px;
  background: var(--separator);
  margin-left: 0;
}

.error {
  color: var(--red);
  font-size: 13px;
  margin: 12px 0 0;
  text-align: center;
}

.submit {
  width: 100%;
  margin: 20px 0 16px;
  padding: 14px;
  border-radius: var(--radius-pill);
  background: var(--blue);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  transition: opacity 0.2s, transform 0.1s;
}

.submit:active {
  transform: scale(0.98);
}

.submit.disabled {
  opacity: 0.4;
}
</style>
