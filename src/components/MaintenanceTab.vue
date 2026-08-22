<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MaintenanceItem, MaintenanceStatus } from '../types'
import MaintenanceCard from './MaintenanceCard.vue'

const props = defineProps<{
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
const search = ref('')

type Filter = 'all' | 'due' | 'soon' | 'ok'
const filter = ref<Filter>('all')
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'due', label: 'Просрочено' },
  { key: 'soon', label: 'Скоро' },
  { key: 'ok', label: 'В порядке' },
]

const filteredStatuses = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.sortedStatuses.filter((s) => {
    if (filter.value !== 'all' && s.state !== filter.value) return false
    if (query && !s.item.name.toLowerCase().includes(query)) return false
    return true
  })
})
</script>

<template>
  <div class="tab-page">
    <header class="topbar">
      <h1>Замена</h1>
    </header>

    <div class="search-row">
      <svg class="search-icon" viewBox="0 0 24 24" width="17" height="17" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" />
        <path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <input v-model="search" type="text" placeholder="Поиск по параметрам" />
      <button v-if="search" class="search-clear" aria-label="Очистить" @click="search = ''">✕</button>
    </div>

    <div class="filter-chips">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        class="filter-chip"
        :class="{ active: filter === f.key }"
        @click="filter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <section class="section">
      <div class="card list">
        <MaintenanceCard
          v-for="status in filteredStatuses"
          :key="status.item.id"
          :status="status"
          @mark-serviced="emit('markServiced', $event)"
          @toggle="(id, enabled) => emit('toggle', id, enabled)"
          @edit="emit('edit', $event)"
        />
        <div v-if="filteredStatuses.length === 0" class="empty">
          {{ sortedStatuses.length === 0 ? 'Все параметры отключены' : 'Ничего не найдено' }}
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

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  margin-bottom: 12px;
  height: 40px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
}

.search-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-row input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--text);
  outline: none;
}

.search-row input::placeholder {
  color: var(--text-tertiary);
}

.search-clear {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--text-tertiary);
  color: var(--bg-elevated);
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 4px 2px;
  margin-bottom: 20px;
}

.filter-chip {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.filter-chip.active {
  background: var(--blue);
  color: #fff;
}

.filter-chip:active {
  opacity: 0.7;
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
  border-radius: var(--radius-lg);
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
  border-radius: var(--radius-pill);
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
