<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  currentMileage: number
}>()

const emit = defineEmits<{
  close: []
  save: [mileage: number]
}>()

const value = ref(String(props.currentMileage))

const number = computed(() => Number(value.value.replace(/\s/g, '')))
const isValid = computed(
  () => value.value.trim().length > 0 && !Number.isNaN(number.value) && number.value >= props.currentMileage,
)

function handleSave() {
  if (!isValid.value) return
  emit('save', Math.round(number.value))
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Отмена</button>
        <h2>Пробег</h2>
        <button class="save" :class="{ disabled: !isValid }" @click="handleSave">
          Готово
        </button>
      </div>
      <div class="form">
        <div class="group">
          <div class="field">
            <label>Текущий пробег, км</label>
            <input v-model="value" type="text" inputmode="numeric" autofocus />
          </div>
        </div>
        <p v-if="!isValid" class="hint">
          Новый пробег не может быть меньше текущего ({{ currentMileage.toLocaleString('ru-RU') }} км)
        </p>
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
  background: var(--bg-grouped);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 8px 0 calc(24px + var(--safe-bottom));
  animation: slide-up 0.25s var(--motion-spring);
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
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
  outline: none;
}

.hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 10px 4px 0;
}
</style>
