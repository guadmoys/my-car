<script setup lang="ts">
import { ref } from 'vue'
import type { MaintenanceItem, MaintenanceStatus } from '../types'
import MaintenanceCard from './MaintenanceCard.vue'

defineProps<{
  sortedStatuses: MaintenanceStatus[]
  disabledItems: MaintenanceItem[]
}>()

const emit = defineEmits<{
  markServiced: [id: string]
  toggle: [id: string, enabled: boolean]
  edit: [id: string]
  addItem: []
}>()

const showDisabled = ref(false)
</script>

<template>
  <div class="tab-page">
    <header class="topbar">
      <h1>Замена</h1>
    </header>

    <section class="section">
      <div class="card list">
        <MaintenanceCard
          v-for="status in sortedStatuses"
          :key="status.item.id"
          :status="status"
          @mark-serviced="emit('markServiced', $event)"
          @toggle="(id, enabled) => emit('toggle', id, enabled)"
          @edit="emit('edit', $event)"
        />
        <div v-if="sortedStatuses.length === 0" class="empty">
          Все параметры отключены
        </div>
      </div>
    </section>

    <section v-if="disabledItems.length > 0" class="section">
      <button class="section-title toggleable" @click="showDisabled = !showDisabled">
        <span>Отключено ({{ disabledItems.length }})</span>
        <span class="caret" :class="{ open: showDisabled }">›</span>
      </button>
      <div v-if="showDisabled" class="card list">
        <div v-for="item in disabledItems" :key="item.id" class="disabled-row">
          <button class="disabled-name" @click="emit('edit', item.id)">{{ item.name }}</button>
          <label class="switch">
            <input
              type="checkbox"
              :checked="item.enabled"
              @change="emit('toggle', item.id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="slider" />
          </label>
        </div>
      </div>
    </section>

    <button class="add-item" @click="emit('addItem')">+ Добавить параметр</button>
  </div>
</template>

<style scoped>
.tab-page {
  max-width: 560px;
  margin: 0 auto;
  padding: calc(16px + var(--safe-top)) 16px calc(96px + var(--safe-bottom));
}

.topbar {
  padding: 8px 4px 20px;
}

.topbar h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0 4px 8px;
}

.section-title.toggleable {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.caret {
  display: inline-block;
  transform: rotate(90deg);
  transition: transform 0.2s;
}

.caret.open {
  transform: rotate(270deg);
}

.card {
  background: var(--bg-elevated);
  border-radius: 16px;
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 15px;
}

.disabled-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--separator);
}

.disabled-row:last-child {
  border-bottom: none;
}

.disabled-name {
  font-size: 16px;
  color: var(--text-secondary);
  text-align: left;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  background: var(--fill-secondary);
  border-radius: 13px;
  transition: background 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.switch input:checked + .slider {
  background: var(--green);
}

.switch input:checked + .slider::before {
  transform: translateX(18px);
}

.add-item {
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  background: var(--fill-secondary);
  color: var(--blue);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.add-item:active {
  opacity: 0.6;
}
</style>
