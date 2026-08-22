<script setup lang="ts">
import type { Car } from '../types'

defineProps<{
  car: Car
  okCount: number
  soonCount: number
  dueCount: number
  averageConsumption: number | null
}>()

const emit = defineEmits<{
  editMileage: []
  switchCar: []
}>()

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <div class="summary">
    <button class="identity" @click="emit('switchCar')">
      <span class="identity-avatar">{{ car.make.charAt(0).toUpperCase() }}</span>
      <span>{{ car.year }} · {{ car.make }} {{ car.model }}</span>
      <span class="identity-caret">›</span>
    </button>

    <button class="mileage-row" @click="emit('editMileage')">
      <div>
        <div class="label">Текущий пробег</div>
        <div class="value">{{ fmt(car.currentMileage) }} <span class="unit">км</span></div>
      </div>
      <div class="chevron">›</div>
    </button>

    <div class="chips">
      <div class="chip">
        <span class="chip-dot ok" />
        {{ okCount }} ок
      </div>
      <div v-if="soonCount > 0" class="chip">
        <span class="chip-dot soon" />
        {{ soonCount }} скоро
      </div>
      <div v-if="dueCount > 0" class="chip">
        <span class="chip-dot due" />
        {{ dueCount }} просрочено
      </div>
      <div v-if="averageConsumption !== null" class="chip fuel">
        ⛽ {{ averageConsumption.toFixed(1) }} л/100км
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary {
  background: linear-gradient(135deg, var(--blue), #0040dd);
  color: #fff;
  border-radius: var(--radius-lg);
  padding: 18px 20px 20px;
  box-shadow: var(--shadow);
  margin-bottom: 28px;
}

.identity {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 10px;
}

.identity:active {
  opacity: 0.6;
}

.identity-caret {
  font-size: 13px;
  transform: rotate(90deg);
}

.identity-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.28);
}

.mileage-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}

.mileage-row:active {
  opacity: 0.8;
}

.label {
  font-size: 13px;
  opacity: 0.85;
  font-weight: 500;
}

.value {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 2px;
}

.unit {
  font-size: 17px;
  font-weight: 500;
  opacity: 0.85;
}

.chevron {
  color: rgba(255, 255, 255, 0.7);
  font-size: 20px;
  font-weight: 500;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 13px;
  font-weight: 600;
}

.chip.fuel {
  background: rgba(255, 255, 255, 0.28);
}

.chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
}

.chip-dot.ok {
  background: var(--green);
}

.chip-dot.soon {
  background: var(--orange);
}

.chip-dot.due {
  background: var(--red);
}
</style>
