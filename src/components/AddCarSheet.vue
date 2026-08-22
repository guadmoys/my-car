<script setup lang="ts">
import { computed, ref } from 'vue'
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
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Отмена</button>
        <h2>Новая машина</h2>
        <button class="save" :class="{ disabled: !isValid }" @click="handleSave">
          Готово
        </button>
      </div>

      <div class="form">
        <div class="group">
          <button class="field picker-field" @click="activePicker = 'make'">
            <label>Марка</label>
            <span class="picker-value" :class="{ placeholder: !make }">{{ make || 'Выбрать' }}</span>
          </button>
          <div class="divider" />
          <button
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
            <label>Год выпуска</label>
            <input v-model="year" type="text" inputmode="numeric" placeholder="2020" />
          </div>
          <div class="divider" />
          <div class="field">
            <label>Текущий пробег, км</label>
            <input v-model="mileage" type="text" inputmode="numeric" placeholder="45000" />
          </div>
        </div>
      </div>
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
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 100;
  animation: fade-in 0.15s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.sheet {
  width: 100%;
  background: var(--bg-grouped);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 8px 0 calc(24px + var(--safe-bottom));
  animation: slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.handle {
  width: 36px;
  height: 5px;
  border-radius: 3px;
  background: var(--text-tertiary);
  margin: 6px auto 4px;
  opacity: 0.5;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 4px;
}

.header h2 {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.cancel {
  font-size: 17px;
  color: var(--blue);
}

.save {
  font-size: 17px;
  font-weight: 600;
  color: var(--blue);
}

.save.disabled {
  opacity: 0.4;
}

.form {
  padding: 12px 16px 0;
}

.group {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 0 14px;
  border: 1px solid var(--card-border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 0;
}

.field label {
  font-size: 12px;
  color: var(--text-secondary);
}

.field input {
  border: none;
  background: transparent;
  font-size: 17px;
  color: var(--text);
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
}

.picker-value.placeholder {
  color: var(--text-tertiary);
}

.divider {
  height: 1px;
  background: var(--separator);
}
</style>
