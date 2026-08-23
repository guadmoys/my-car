<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MaintenanceItem, MaintenanceStatus } from '../types'
import MaintenanceCard from './MaintenanceCard.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  sortedStatuses: MaintenanceStatus[]
  disabledItems: MaintenanceItem[]
}>()

const emit = defineEmits<{
  markServiced: [id: string]
  toggle: [id: string, enabled: boolean]
  bulkToggle: [ids: string[], enabled: boolean]
  edit: [id: string]
  delete: [id: string]
  reorderDisabled: [id: string, direction: 'up' | 'down']
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

function selectFilter(key: Filter) {
  if (filter.value === key) return
  haptic('tap')
  filter.value = key
}

function matchesQuery(item: MaintenanceItem, query: string): boolean {
  if (item.name.toLowerCase().includes(query)) return true
  return item.parts.some(
    (p) => p.name.toLowerCase().includes(query) || p.articleNumber.toLowerCase().includes(query),
  )
}

const searchQuery = computed(() => search.value.trim().toLowerCase())

const filteredStatuses = computed(() => {
  const query = searchQuery.value
  return props.sortedStatuses.filter((s) => {
    if (filter.value !== 'all' && s.state !== filter.value) return false
    if (query && !matchesQuery(s.item, query)) return false
    return true
  })
})

const filteredDisabledItems = computed(() => {
  const query = searchQuery.value
  if (!query) return props.disabledItems
  return props.disabledItems.filter((item) => matchesQuery(item, query))
})

const disabledSectionOpen = computed(
  () => showDisabled.value || (searchQuery.value !== '' && filteredDisabledItems.value.length > 0),
)

// Reordering acts on the full disabled order, so it's hidden while a search
// query narrows which neighbours are even visible.
const canReorder = computed(() => searchQuery.value === '')

const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  selectedIds.value = new Set()
}

function toggleSelect(id: string) {
  haptic('tap')
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function bulkSetEnabled(enabled: boolean) {
  emit('bulkToggle', Array.from(selectedIds.value), enabled)
  selectMode.value = false
  selectedIds.value = new Set()
}
</script>

<template>
  <div class="tab-page">
    <header class="topbar">
      <h1>Замена</h1>
      <button class="select-mode-btn" @click="toggleSelectMode">
        {{ selectMode ? 'Отмена' : 'Выбрать' }}
      </button>
    </header>

    <div class="search-row">
      <svg class="search-icon" viewBox="0 0 24 24" width="17" height="17" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" />
        <path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <input v-model="search" type="text" placeholder="Поиск по параметрам" aria-label="Поиск по параметрам" />
      <button v-if="search" class="search-clear" aria-label="Очистить" @click="search = ''">✕</button>
    </div>

    <div class="filter-chips">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        class="filter-chip"
        :class="{ active: filter === f.key }"
        @click="selectFilter(f.key)"
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
          :selectable="selectMode"
          :selected="selectedIds.has(status.item.id)"
          @mark-serviced="emit('markServiced', $event)"
          @toggle="(id, enabled) => emit('toggle', id, enabled)"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
          @select="toggleSelect"
        />
        <div v-if="filteredStatuses.length === 0" class="empty">
          {{ sortedStatuses.length === 0 ? 'Все параметры отключены' : 'Ничего не найдено' }}
        </div>
      </div>
    </section>

    <section v-if="disabledItems.length > 0" class="section">
      <button class="section-title toggleable" @click="showDisabled = !showDisabled">
        <span>Отключено ({{ disabledItems.length }})</span>
        <span class="caret" :class="{ open: disabledSectionOpen }">›</span>
      </button>
      <div v-if="disabledSectionOpen" class="card list">
        <div v-for="(item, index) in filteredDisabledItems" :key="item.id" class="disabled-row">
          <button
            v-if="selectMode"
            class="disabled-select-target"
            @click="toggleSelect(item.id)"
          >
            <div class="checkbox" :class="{ checked: selectedIds.has(item.id) }">
              <svg v-if="selectedIds.has(item.id)" viewBox="0 0 24 24" width="13" height="13" fill="none">
                <path d="M5 13l4.5 4.5L19 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <span class="disabled-name">{{ item.name }}</span>
          </button>
          <template v-else>
            <button class="disabled-name" @click="emit('edit', item.id)">{{ item.name }}</button>
            <div class="disabled-row-controls">
              <div v-if="canReorder" class="reorder-buttons">
                <button
                  class="reorder-btn"
                  aria-label="Переместить выше"
                  :disabled="index === 0"
                  @click="emit('reorderDisabled', item.id, 'up')"
                >
                  ▲
                </button>
                <button
                  class="reorder-btn"
                  aria-label="Переместить ниже"
                  :disabled="index === filteredDisabledItems.length - 1"
                  @click="emit('reorderDisabled', item.id, 'down')"
                >
                  ▼
                </button>
              </div>
              <ToggleSwitch
                :checked="item.enabled"
                :aria-label="`Учитывать «${item.name}»`"
                @update:checked="(v) => emit('toggle', item.id, v)"
              />
            </div>
          </template>
        </div>
        <div v-if="filteredDisabledItems.length === 0" class="empty">Ничего не найдено</div>
      </div>
    </section>

    <div v-if="selectMode && selectedIds.size > 0" class="bulk-bar">
      <span class="bulk-count">Выбрано: {{ selectedIds.size }}</span>
      <div class="bulk-actions">
        <button class="bulk-btn enable" @click="bulkSetEnabled(true)">Включить</button>
        <button class="bulk-btn disable" @click="bulkSetEnabled(false)">Отключить</button>
      </div>
    </div>

    <button v-if="!selectMode" class="add-item" @click="emit('addItem')">+ Добавить параметр</button>
  </div>
</template>

<style scoped>
.tab-page {
  max-width: 560px;
  margin: 0 auto;
  padding: calc(16px + var(--safe-top)) 16px calc(96px + var(--safe-bottom));
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 20px;
}

.topbar h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.select-mode-btn {
  font-size: 16px;
  font-weight: 500;
  color: var(--blue);
}

.select-mode-btn:active {
  opacity: 0.6;
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

.disabled-select-target {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.disabled-select-target .disabled-name {
  flex: 1;
}

.checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--separator);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--motion-fast), border-color var(--motion-fast);
}

.checkbox.checked {
  background: var(--blue);
  border-color: var(--blue);
}

.disabled-row-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.reorder-buttons {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reorder-btn {
  width: 22px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 9px;
  line-height: 1;
}

.reorder-btn:active:not(:disabled) {
  opacity: 0.5;
}

.reorder-btn:disabled {
  opacity: 0.25;
}

.bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
}

.bulk-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.bulk-actions {
  display: flex;
  gap: 8px;
}

.bulk-btn {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.bulk-btn.enable {
  background: var(--green);
  color: #fff;
}

.bulk-btn.disable {
  background: var(--fill-secondary);
  color: var(--text);
}

.bulk-btn:active {
  opacity: 0.7;
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
