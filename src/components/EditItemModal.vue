<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HistoryEntry, MaintenanceItem, Part } from '../types'
import CostEditSheet from './CostEditSheet.vue'
import PartQuickLinks from './PartQuickLinks.vue'
import { downloadIcsReminder } from '../utils/ics'

function addMonths(ts: number, months: number): number {
  const d = new Date(ts)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

const props = defineProps<{
  item: MaintenanceItem | null
  currentMileage: number
  history: HistoryEntry[]
}>()

function fmtHistoryDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMileage(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtCost(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      name: string
      intervalKm: number
      intervalKmMax?: number
      intervalMonths?: number
      lastServiceMileage: number
      parts: Part[]
      notifyBeforeKm?: number
      notifyBeforeDays?: number
    },
  ]
  create: [
    payload: {
      name: string
      intervalKm: number
      intervalKmMax?: number
      intervalMonths?: number
      parts: Part[]
      notifyBeforeKm?: number
      notifyBeforeDays?: number
    },
  ]
  delete: [id: string]
  updateHistoryCost: [id: string, cost: number | null]
}>()

const editingHistoryId = ref<string | null>(null)
const editingHistoryEntry = computed(
  () => props.history.find((h) => h.id === editingHistoryId.value) ?? null,
)

function handleSaveHistoryCost(cost: number | null) {
  if (editingHistoryId.value) emit('updateHistoryCost', editingHistoryId.value, cost)
  editingHistoryId.value = null
}

const isCreate = computed(() => props.item === null)

const name = ref('')
const interval = ref('')
const intervalMax = ref('')
const intervalMonths = ref('')
const lastServiceMileage = ref('')
const parts = ref<Part[]>([])
const notifyBeforeKm = ref('')
const notifyBeforeDays = ref('')
const showAdvanced = ref(false)

const defaultDaysThreshold = computed(() => {
  const months = Number(intervalMonths.value) || 0
  const totalDays = addMonths(0, months) / (24 * 60 * 60 * 1000)
  return Math.round(totalDays * 0.1)
})

function makePartId(): string {
  return `part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function addPart() {
  parts.value.push({ id: makePartId(), name: '', articleNumber: '', platform: '', url: '' })
}

function removePart(id: string) {
  parts.value = parts.value.filter((p) => p.id !== id)
}

watch(
  () => props.item,
  (item) => {
    if (item) {
      name.value = item.name
      interval.value = String(item.intervalKm)
      intervalMax.value = item.intervalKmMax ? String(item.intervalKmMax) : ''
      intervalMonths.value = item.intervalMonths ? String(item.intervalMonths) : ''
      lastServiceMileage.value = String(item.lastServiceMileage)
      parts.value = item.parts.map((p) => ({ ...p }))
      notifyBeforeKm.value = item.notifyBeforeKm ? String(item.notifyBeforeKm) : ''
      notifyBeforeDays.value = item.notifyBeforeDays ? String(item.notifyBeforeDays) : ''
      showAdvanced.value = Boolean(item.notifyBeforeKm || item.notifyBeforeDays)
    } else {
      name.value = ''
      interval.value = ''
      intervalMax.value = ''
      intervalMonths.value = ''
      lastServiceMileage.value = String(props.currentMileage)
      parts.value = []
      notifyBeforeKm.value = ''
      notifyBeforeDays.value = ''
      showAdvanced.value = false
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
  if (intervalMonths.value.trim()) {
    const months = Number(intervalMonths.value)
    if (Number.isNaN(months) || months <= 0) return false
  }
  if (!isCreate.value) {
    const l = Number(lastServiceMileage.value)
    if (Number.isNaN(l) || l < 0 || l > props.currentMileage) return false
  }
  if (notifyBeforeKm.value.trim()) {
    const n = Number(notifyBeforeKm.value)
    if (Number.isNaN(n) || n <= 0) return false
  }
  if (notifyBeforeDays.value.trim()) {
    const n = Number(notifyBeforeDays.value)
    if (Number.isNaN(n) || n <= 0) return false
  }
  return true
})

function cleanedParts(): Part[] {
  return parts.value
    .filter((p) => p.name.trim())
    .map((p) => ({
      id: p.id,
      name: p.name.trim(),
      articleNumber: p.articleNumber.trim(),
      platform: p.platform.trim(),
      url: p.url?.trim() || undefined,
    }))
}

function handleSave() {
  if (!isValid.value) return
  const intervalKm = Math.round(Number(interval.value))
  const intervalKmMax = intervalMax.value.trim() ? Math.round(Number(intervalMax.value)) : undefined
  const intervalMonthsValue = intervalMonths.value.trim()
    ? Math.round(Number(intervalMonths.value))
    : undefined
  const notifyBeforeKmValue = notifyBeforeKm.value.trim()
    ? Math.round(Number(notifyBeforeKm.value))
    : undefined
  const notifyBeforeDaysValue = notifyBeforeDays.value.trim()
    ? Math.round(Number(notifyBeforeDays.value))
    : undefined

  if (isCreate.value) {
    emit('create', {
      name: name.value.trim(),
      intervalKm,
      intervalKmMax,
      intervalMonths: intervalMonthsValue,
      parts: cleanedParts(),
      notifyBeforeKm: notifyBeforeKmValue,
      notifyBeforeDays: notifyBeforeDaysValue,
    })
  } else if (props.item) {
    emit('save', {
      name: name.value.trim(),
      intervalKm,
      intervalKmMax,
      intervalMonths: intervalMonthsValue,
      lastServiceMileage: Math.round(Number(lastServiceMileage.value)),
      parts: cleanedParts(),
      notifyBeforeKm: notifyBeforeKmValue,
      notifyBeforeDays: notifyBeforeDaysValue,
    })
  }
}

function handleDelete() {
  if (props.item) emit('delete', props.item.id)
}

const nextDueAt = computed<number | null>(() => {
  if (isCreate.value || !props.item?.intervalMonths || !props.item.lastServiceDate) return null
  return addMonths(props.item.lastServiceDate, props.item.intervalMonths)
})

function handleAddToCalendar() {
  if (!props.item || nextDueAt.value === null) return
  downloadIcsReminder({
    title: `ТО: ${props.item.name}`,
    description: `Напоминание из приложения «Моя машина» — раз в ${props.item.intervalMonths} мес.`,
    dueAt: nextDueAt.value,
  })
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
          <div class="divider" />
          <div class="field">
            <label>Или раз в N месяцев (необязательно)</label>
            <input v-model="intervalMonths" type="text" inputmode="numeric" placeholder="—" />
          </div>
        </div>

        <div class="advanced-block">
          <button class="section-title toggleable" @click="showAdvanced = !showAdvanced">
            <span>Дополнительно</span>
            <span class="caret" :class="{ open: showAdvanced }">›</span>
          </button>
          <div v-if="showAdvanced" class="group">
            <div class="field">
              <label>Уведомлять за, км до ТО</label>
              <input
                v-model="notifyBeforeKm"
                type="text"
                inputmode="numeric"
                :placeholder="`по умолчанию ${Math.round((Number(interval) || 0) * 0.1)}`"
              />
            </div>
            <template v-if="intervalMonths.trim()">
              <div class="divider" />
              <div class="field">
                <label>Уведомлять за, дней до ТО</label>
                <input
                  v-model="notifyBeforeDays"
                  type="text"
                  inputmode="numeric"
                  :placeholder="`по умолчанию ${defaultDaysThreshold}`"
                />
              </div>
            </template>
          </div>
          <p v-if="showAdvanced" class="hint advanced-hint">
            Определяет, когда параметр станет «скоро» и придёт уведомление (если оно включено в настройках)
          </p>
        </div>

        <div v-if="!isCreate" class="group">
          <div class="field">
            <label>Пробег последнего ТО, км</label>
            <input v-model="lastServiceMileage" type="text" inputmode="numeric" />
          </div>
        </div>
        <p v-if="!isCreate && Number(lastServiceMileage) > currentMileage" class="hint mileage-hint">
          Не может быть больше текущего пробега машины ({{ fmtMileage(currentMileage) }} км)
        </p>

        <button v-if="nextDueAt !== null" class="calendar-btn" @click="handleAddToCalendar">
          🗓 Добавить напоминание в календарь
        </button>

        <div v-if="!isCreate && history.length > 0" class="history-block">
          <div class="parts-header">
            <span>История ТО</span>
          </div>
          <div class="group history-list">
            <button
              v-for="entry in history"
              :key="entry.id"
              class="history-row"
              @click="editingHistoryId = entry.id"
            >
              <span class="history-date">{{ fmtHistoryDate(entry.date) }}</span>
              <span class="history-right">
                <span v-if="entry.cost !== undefined" class="history-cost">{{ fmtCost(entry.cost) }}</span>
                <span class="history-mileage">{{ fmtMileage(entry.mileage) }} км</span>
              </span>
            </button>
          </div>
        </div>

        <CostEditSheet
          v-if="editingHistoryEntry"
          title="ТО"
          :subtitle="fmtHistoryDate(editingHistoryEntry.date)"
          :current-cost="editingHistoryEntry.cost"
          @close="editingHistoryId = null"
          @save="handleSaveHistoryCost"
        />

        <div class="parts-block">
          <div class="parts-header">
            <span>Детали</span>
            <span class="parts-hint">название, артикул и площадка для быстрой покупки</span>
          </div>

          <div v-for="(part, index) in parts" :key="part.id" class="group part-card">
            <div class="part-card-header">
              <span>Деталь {{ index + 1 }}</span>
              <button class="part-remove" aria-label="Удалить деталь" @click="removePart(part.id)">
                ✕
              </button>
            </div>
            <div class="divider" />
            <div class="field">
              <label>Название</label>
              <input v-model="part.name" type="text" placeholder="Фильтр масляный" />
            </div>
            <div class="divider" />
            <div class="field">
              <label>Артикул</label>
              <input v-model="part.articleNumber" type="text" placeholder="2630035503" />
            </div>
            <div class="divider" />
            <div class="field">
              <label>Площадка</label>
              <input v-model="part.platform" type="text" placeholder="Exist.ru" />
            </div>
            <div class="divider" />
            <div class="field">
              <label>Ссылка на покупку (необязательно)</label>
              <input v-model="part.url" type="url" placeholder="https://..." />
            </div>
            <div class="divider" />
            <div class="part-links">
              <PartQuickLinks :part="part" />
            </div>
          </div>

          <button class="add-part" @click="addPart">+ Добавить деталь</button>
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
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.divider {
  height: 1px;
  background: var(--separator);
}

.history-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-list {
  padding: 0 14px;
}

.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 0;
  border-bottom: 1px solid var(--separator);
  font-size: 15px;
  text-align: left;
}

.history-row:active {
  opacity: 0.6;
}

.history-row:last-child {
  border-bottom: none;
}

.history-date {
  color: var(--text);
}

.history-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-cost {
  color: var(--blue);
  font-weight: 600;
}

.history-mileage {
  color: var(--text-secondary);
}

.advanced-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0 4px;
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

.advanced-hint {
  padding: 0 4px;
}

.mileage-hint {
  margin-top: -12px;
  padding: 0 4px;
  color: var(--red);
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.parts-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.parts-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}

.parts-header span:first-child {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.parts-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.part-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.part-remove {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.part-remove:active {
  opacity: 0.6;
}

.part-links {
  padding: 10px 0;
}

.add-part {
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
  color: var(--blue);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.add-part:active {
  opacity: 0.6;
}

.calendar-btn {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-pill);
  padding: 13px;
  color: var(--blue);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.calendar-btn:active {
  opacity: 0.6;
}

.delete {
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-pill);
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
