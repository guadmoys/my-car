<script setup lang="ts">
import { ref } from 'vue'
import type { Car } from '../types'

const props = defineProps<{
  cars: Car[]
  activeCarId: string
}>()

const emit = defineEmits<{
  close: []
  switch: [id: string]
  delete: [id: string]
  addCar: []
}>()

const confirmingDeleteId = ref<string | null>(null)

function handleSelect(id: string) {
  if (id === props.activeCarId) {
    emit('close')
    return
  }
  emit('switch', id)
  emit('close')
}

function handleDeleteClick(id: string) {
  if (confirmingDeleteId.value !== id) {
    confirmingDeleteId.value = id
    return
  }
  emit('delete', id)
  confirmingDeleteId.value = null
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Закрыть</button>
        <h2>Мои машины</h2>
        <span class="spacer" />
      </div>

      <div class="form">
        <div class="card">
          <div v-for="c in cars" :key="c.id" class="car-row" :class="{ active: c.id === activeCarId }">
            <button class="car-main" @click="handleSelect(c.id)">
              <span class="check" :class="{ visible: c.id === activeCarId }">✓</span>
              <span class="car-info">
                <span class="car-name">{{ c.year }} · {{ c.make }} {{ c.model }}</span>
                <span class="car-mileage">{{ fmt(c.currentMileage) }} км</span>
              </span>
            </button>
            <button
              class="delete-btn"
              :class="{ confirming: confirmingDeleteId === c.id }"
              @click="handleDeleteClick(c.id)"
            >
              {{ confirmingDeleteId === c.id ? 'Точно?' : 'Удалить' }}
            </button>
          </div>
        </div>

        <button class="add-car" @click="emit('addCar')">+ Добавить машину</button>
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

.spacer {
  width: 56px;
}

.form {
  padding: 12px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--bg-elevated);
  border-radius: 14px;
  border: 1px solid var(--card-border);
  overflow: hidden;
}

.car-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-bottom: 1px solid var(--separator);
}

.car-row:last-child {
  border-bottom: none;
}

.car-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  text-align: left;
}

.check {
  width: 20px;
  color: var(--blue);
  font-weight: 700;
  font-size: 15px;
  opacity: 0;
  flex-shrink: 0;
}

.check.visible {
  opacity: 1;
}

.car-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.car-name {
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.car-mileage {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.delete-btn {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--red);
  padding: 8px 10px;
  border-radius: 8px;
}

.delete-btn.confirming {
  background: color-mix(in srgb, var(--red) 12%, transparent);
}

.delete-btn:active {
  opacity: 0.6;
}

.add-car {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  background: var(--fill-secondary);
  color: var(--blue);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.add-car:active {
  opacity: 0.6;
}
</style>
