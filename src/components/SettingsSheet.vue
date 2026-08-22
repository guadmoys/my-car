<script setup lang="ts">
import { ref } from 'vue'
import type { Car } from '../types'

const props = defineProps<{
  car: Car
  importError: string | null
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { make: string; model: string; year: number }]
  deleteCar: []
  export: []
  import: [file: File]
}>()

const make = ref(props.car.make)
const model = ref(props.car.model)
const year = ref(String(props.car.year))
const confirmingDelete = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleSave() {
  const y = Number(year.value)
  if (!make.value.trim() || !model.value.trim() || Number.isNaN(y)) return
  emit('save', { make: make.value.trim(), model: model.value.trim(), year: y })
}

function handleDelete() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  emit('deleteCar')
}

function triggerImport() {
  fileInput.value?.click()
}

function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('import', file)
  input.value = ''
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Закрыть</button>
        <h2>Настройки</h2>
        <button class="save" @click="handleSave">Готово</button>
      </div>

      <div class="form">
        <div class="group">
          <div class="field">
            <label>Марка</label>
            <input v-model="make" type="text" />
          </div>
          <div class="divider" />
          <div class="field">
            <label>Модель</label>
            <input v-model="model" type="text" />
          </div>
          <div class="divider" />
          <div class="field">
            <label>Год выпуска</label>
            <input v-model="year" type="text" inputmode="numeric" />
          </div>
        </div>

        <div class="backup-zone">
          <div class="parts-header">Резервная копия</div>
          <button class="backup-btn" @click="emit('export')">Экспортировать данные</button>
          <button class="backup-btn" @click="triggerImport">Импортировать резервную копию</button>
          <input
            ref="fileInput"
            type="file"
            accept="application/json"
            class="sr-only"
            @change="handleFileSelected"
          />
          <p v-if="importError" class="hint error">{{ importError }}</p>
          <p v-else class="hint">
            Экспорт сохраняет машину, параметры ТО, заправки и историю в файл. Импорт полностью
            заменит текущие данные содержимым файла
          </p>
        </div>

        <div class="danger-zone">
          <button class="reset" @click="handleDelete">
            {{ confirmingDelete ? 'Точно удалить эту машину?' : 'Удалить эту машину' }}
          </button>
          <p class="hint">
            Удалит эту машину, её параметры ТО, заправки и историю без возможности восстановления.
            Другие ваши машины не затронет
          </p>
        </div>
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

.cancel,
.save {
  font-size: 17px;
  color: var(--blue);
}

.save {
  font-weight: 600;
}

.form {
  padding: 12px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
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

.backup-zone,
.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.parts-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0 4px;
}

.backup-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 13px;
  color: var(--blue);
  font-size: 17px;
  font-weight: 500;
  text-align: center;
}

.backup-btn:active {
  opacity: 0.6;
}

.hint.error {
  color: var(--red);
}

.reset {
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 13px;
  color: var(--red);
  font-size: 17px;
  font-weight: 500;
  text-align: center;
}

.reset:active {
  opacity: 0.6;
}

.hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 4px;
  line-height: 1.4;
}
</style>
