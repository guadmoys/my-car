<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { calendarOutline, close, trash } from 'ionicons/icons'
import type { HistoryEntry, MaintenanceItem, Part } from '../types'
import HistoryEditSheet from './HistoryEditSheet.vue'
import PartQuickLinks from './PartQuickLinks.vue'
import { downloadIcsReminder } from '../utils/ics'
import { adaptiveKmThreshold, adaptiveDayThreshold } from '../utils/adaptiveThreshold'

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
  updateHistory: [
    id: string,
    payload: { itemName: string; mileage: number; date: number; cost?: number; receiptPhoto?: string },
  ]
}>()

const editingHistoryId = ref<string | null>(null)
const editingHistoryEntry = computed(
  () => props.history.find((h) => h.id === editingHistoryId.value) ?? null,
)

function handleSaveHistory(payload: { itemName: string; mileage: number; date: number; cost?: number; receiptPhoto?: string }) {
  if (editingHistoryId.value) emit('updateHistory', editingHistoryId.value, payload)
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
const advancedValue = ref<string | undefined>(undefined)

const kmThresholdDefault = computed(() => {
  const intervalKm = Number(interval.value) || 0
  return adaptiveKmThreshold(intervalKm, undefined, props.history.map((h) => h.mileage))
})

const dayThresholdDefault = computed(() => {
  const months = Number(intervalMonths.value) || 0
  const totalSpanMs = addMonths(0, months)
  return adaptiveDayThreshold(totalSpanMs, undefined, props.history.map((h) => h.date))
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
      advancedValue.value = item.notifyBeforeKm || item.notifyBeforeDays ? 'advanced' : undefined
    } else {
      name.value = ''
      interval.value = ''
      intervalMax.value = ''
      intervalMonths.value = ''
      lastServiceMileage.value = String(props.currentMileage)
      parts.value = []
      notifyBeforeKm.value = ''
      notifyBeforeDays.value = ''
      advancedValue.value = undefined
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
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>{{ isCreate ? 'Новый параметр' : 'Изменить' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="none">
          <ion-input v-model="name" label="Название" label-placement="stacked" placeholder="Например, Замена масла" />
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-item>
          <ion-input v-model="interval" label="Интервал, км" label-placement="stacked" inputmode="numeric" placeholder="5000" />
        </ion-item>
        <ion-item>
          <ion-input v-model="intervalMax" label="До (необязательно, для диапазона)" label-placement="stacked" inputmode="numeric" placeholder="—" />
        </ion-item>
        <ion-item lines="none">
          <ion-input v-model="intervalMonths" label="Или раз в N месяцев (необязательно)" label-placement="stacked" inputmode="numeric" placeholder="—" />
        </ion-item>
      </ion-list>

      <ion-accordion-group v-model="advancedValue">
        <ion-accordion value="advanced">
          <ion-item slot="header">
            <ion-label>Дополнительно</ion-label>
          </ion-item>
          <ion-list slot="content" inset>
            <ion-item :lines="intervalMonths.trim() ? undefined : 'none'">
              <ion-input
                v-model="notifyBeforeKm"
                label="Уведомлять за, км до ТО"
                label-placement="stacked"
                inputmode="numeric"
                :placeholder="`по умолчанию ${Math.round(kmThresholdDefault.value)}`"
              />
            </ion-item>
            <ion-item v-if="intervalMonths.trim()" lines="none">
              <ion-input
                v-model="notifyBeforeDays"
                label="Уведомлять за, дней до ТО"
                label-placement="stacked"
                inputmode="numeric"
                :placeholder="`по умолчанию ${Math.round(dayThresholdDefault.value)}`"
              />
            </ion-item>
          </ion-list>
          <ion-note slot="content" color="medium" class="hint">
            Определяет, когда параметр станет «скоро» и придёт уведомление (если оно включено в настройках)
          </ion-note>
          <ion-note v-if="!notifyBeforeKm.trim() && kmThresholdDefault.adaptive" slot="content" color="primary" class="hint">
            📈 Подстроено под вашу историю: обычно вы делаете это ТО раньше срока — порог сдвинут пораньше
          </ion-note>
          <ion-note v-if="!notifyBeforeDays.trim() && dayThresholdDefault.adaptive" slot="content" color="primary" class="hint">
            📈 Подстроено под вашу историю: обычно вы делаете это ТО раньше срока — порог сдвинут пораньше
          </ion-note>
        </ion-accordion>
      </ion-accordion-group>

      <ion-list v-if="!isCreate" inset>
        <ion-item lines="none">
          <ion-input v-model="lastServiceMileage" label="Пробег последнего ТО, км" label-placement="stacked" inputmode="numeric" />
        </ion-item>
      </ion-list>
      <ion-note v-if="!isCreate && Number(lastServiceMileage) > currentMileage" color="danger" class="hint">
        Не может быть больше текущего пробега машины ({{ fmtMileage(currentMileage) }} км)
      </ion-note>

      <ion-button v-if="nextDueAt !== null" expand="block" fill="outline" class="ion-margin" @click="handleAddToCalendar">
        <ion-icon slot="start" :icon="calendarOutline" />
        Добавить напоминание в календарь
      </ion-button>

      <ion-list v-if="!isCreate && history.length > 0" inset>
        <ion-list-header>История ТО</ion-list-header>
        <ion-item v-for="entry in history" :key="entry.id" button :detail="false" @click="editingHistoryId = entry.id">
          <ion-label>{{ fmtHistoryDate(entry.date) }}</ion-label>
          <ion-note v-if="entry.cost !== undefined" slot="end" color="primary">{{ fmtCost(entry.cost) }}</ion-note>
          <ion-note slot="end">{{ fmtMileage(entry.mileage) }} км</ion-note>
        </ion-item>
      </ion-list>

      <HistoryEditSheet
        v-if="editingHistoryEntry"
        :entry="editingHistoryEntry"
        :current-mileage="currentMileage"
        @close="editingHistoryId = null"
        @save="handleSaveHistory"
      />

      <ion-list inset>
        <ion-list-header>Детали</ion-list-header>
        <template v-for="(part, index) in parts" :key="part.id">
          <ion-item lines="full">
            <ion-label color="medium">Деталь {{ index + 1 }}</ion-label>
            <ion-button slot="end" fill="clear" color="medium" aria-label="Удалить деталь" @click="removePart(part.id)">
              <ion-icon slot="icon-only" :icon="close" />
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-input v-model="part.name" label="Название" label-placement="stacked" placeholder="Фильтр масляный" />
          </ion-item>
          <ion-item>
            <ion-input v-model="part.articleNumber" label="Артикул" label-placement="stacked" placeholder="2630035503" />
          </ion-item>
          <ion-item>
            <ion-input v-model="part.platform" label="Площадка" label-placement="stacked" placeholder="Exist.ru" />
          </ion-item>
          <ion-item>
            <ion-input v-model="part.url" type="url" label="Ссылка на покупку (необязательно)" label-placement="stacked" placeholder="https://..." />
          </ion-item>
          <ion-item lines="none">
            <PartQuickLinks :part="part" />
          </ion-item>
        </template>
      </ion-list>
      <ion-button expand="block" fill="outline" class="ion-margin" @click="addPart">+ Добавить деталь</ion-button>

      <ion-button v-if="!isCreate" expand="block" fill="outline" color="danger" class="ion-margin" @click="handleDelete">
        <ion-icon slot="start" :icon="trash" />
        Удалить параметр
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint {
  display: block;
  font-size: 12px;
  margin: 6px 32px;
}
</style>
