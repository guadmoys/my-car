<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MaintenanceItem } from '../types'

const props = defineProps<{
  item: MaintenanceItem | null
  currentMileage: number
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { name: string; intervalKm: number; intervalKmMax?: number; lastServiceMileage: number }]
  create: [payload: { name: string; intervalKm: number; intervalKmMax?: number }]
  delete: [id: string]
}>()

const isCreate = computed(() => props.item === null)

const name = ref('')
const interval = ref('')
const intervalMax = ref('')
const lastServiceMileage = ref('')

watch(
  () => props.item,
  (item) => {
    if (item) {
      name.value = item.name
      interval.value = String(item.intervalKm)
      intervalMax.value = item.intervalKmMax ? String(item.intervalKmMax) : ''
      lastServiceMileage.value = String(item.lastServiceMileage)
    } else {
      name.value = ''
      interval.value = ''
      intervalMax.value = ''
      lastServiceMileage.value = String(props.currentMileage)
    }
  },
  { immediate: true },
)

const isValid = computed(() => {
  const i = Number(interval.value)
  if (!name.value.trim() || Number.isNaN(i) || i <= 0) return false
  if (intervalMax.value.trim()) {
    const max = Number(intervalMax.value)
    if (Number.isNaN(max) || max <= i) return false
  }
  if (!isCreate.value) {
    const l = Number(lastServiceMileage.value)
    if (Number.isNaN(l) || l < 0) return false
  }
  return true
})

function handleSave() {
  if (!isValid.value) return
  const intervalKm = Math.round(Number(interval.value))
  const intervalKmMax = intervalMax.value.trim() ? Math.round(Number(intervalMax.value)) : undefined

  if (isCreate.value) {
    emit('create', { name: name.value.trim(), intervalKm, intervalKmMax })
  } else if (props.item) {
    emit('save', {
      name: name.value.trim(),
      intervalKm,
      intervalKmMax,
      lastServiceMileage: Math.round(Number(lastServiceMileage.value)),
    })
  }
}

function handleDelete() {
  if (props.item) emit('delete', props.item.id)
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Отмена</button>
        <h2>{{ isCreate ? 'Новый параметр' : 'Изменить' }}</h2>
        <button class="save" :class="{ disabled: !isValid }" @click="handleSave">
          Готово
        </button>
      </div>

      <div class="form">
        <div class="group">
          <div class="field">
            <label>Название</label>
            <input v-model="name" type="text" placeholder="Например, Замена масла" />
          </div>
        </div>

        <div class="group">
          <div class="field">
            <label>Интервал, км</label>
            <input v-model="interval" type="text" inputmode="numeric" placeholder="5000" />
          </div>
          <div class="divider" />
          <div class="field">
            <label>До (необязательно, для диапазона)</label>
            <input v-model="intervalMax" type="text" inputmode="numeric" placeholder="—" />
          </div>
        </div>

        <div v-if="!isCreate" class="group">
          <div class="field">
            <label>Пробег последнего ТО, км</label>
            <input v-model="lastServiceMileage" type="text" inputmode="numeric" />
          </div>
        </div>

        <button v-if="!isCreate" class="delete" @click="handleDelete">
          Удалить параметр
        </button>
      </div>
    </div>
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
  max-height: 88dvh;
  overflow-y: auto;
  background: var(--bg-grouped);
  border-radius: 20px 20px 0 0;
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
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.group {
  background: var(--bg-elevated);
  border-radius: 14px;
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

.divider {
  height: 1px;
  background: var(--separator);
}

.delete {
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 13px;
  color: var(--red);
  font-size: 17px;
  font-weight: 500;
  text-align: center;
}

.delete:active {
  opacity: 0.6;
}
</style>
