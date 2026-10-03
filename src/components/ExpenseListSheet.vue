<script setup lang="ts">
import { formatMoney } from '../utils/currency'
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { add, alertCircleOutline, buildOutline, carSportOutline, cardOutline, receiptOutline, shieldCheckmarkOutline, walletOutline } from 'ionicons/icons'
import { EXPENSE_CATEGORY_LABELS, type Expense, type ExpenseCategory } from '../types'
import { itemLine } from '../utils/expenseItems'
import { useCarStore } from '../composables/useCarStore'

const props = defineProps<{
  expenses: Expense[]
  total: number
}>()

const emit = defineEmits<{
  close: []
  edit: [expense: Expense]
  delete: [id: string]
  addExpense: []
}>()

const store = useCarStore()
function masterName(id: string): string | undefined {
  return store.masters.find((m) => m.id === id)?.name
}

const query = ref('')
const category = ref<ExpenseCategory | 'all'>('all')

const filteredExpenses = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.expenses.filter((e) => {
    if (category.value !== 'all' && e.category !== category.value) return false
    if (!q) return true
    const text = [e.title, EXPENSE_CATEGORY_LABELS[e.category], e.note, e.amount].filter((p) => p !== undefined).join(' ').toLowerCase()
    return text.includes(q)
  })
})

interface MonthGroup {
  key: string
  label: string
  expenses: Expense[]
  total: number
}

/** Chronological, newest first, split only by month headers. */
const months = computed<MonthGroup[]>(() => {
  const sorted = [...filteredExpenses.value].sort((a, b) => b.date - a.date)
  const result: MonthGroup[] = []
  for (const e of sorted) {
    const d = new Date(e.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let group = result[result.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }), expenses: [], total: 0 }
      result.push(group)
    }
    group.expenses.push(e)
    group.total += e.amount
  }
  return result
})

const isFiltered = computed(() => query.value.trim() !== '' || category.value !== 'all')
const filteredTotal = computed(() => filteredExpenses.value.reduce((sum, e) => sum + e.amount, 0))
const categoryOptions = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]

const confirmingDeleteId = ref<string | null>(null)

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  insurance: shieldCheckmarkOutline,
  parking: carSportOutline,
  fine: alertCircleOutline,
  tax: receiptOutline,
  loan: cardOutline,
  damage: buildOutline,
  other: walletOutline,
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
  return formatMoney(n)
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Прочие расходы</ion-title>
      </ion-toolbar>
      <ion-toolbar v-if="expenses.length > 0">
        <ion-searchbar v-model="query" placeholder="Поиск по названию и заметке" :debounce="200" />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list v-if="expenses.length > 0" inset>
        <ion-item lines="none">
          <ion-label><strong>{{ isFiltered ? 'Итого по фильтру' : 'Итого' }}</strong></ion-label>
          <ion-note slot="end" color="primary"><strong>{{ fmt(isFiltered ? filteredTotal : total) }}</strong></ion-note>
        </ion-item>
        <ion-item lines="none">
          <ion-select v-model="category" label="Категория" interface="action-sheet" :interface-options="{ cancelText: 'Отмена' }">
            <ion-select-option value="all">Все</ion-select-option>
            <ion-select-option v-for="[key, label] in categoryOptions" :key="key" :value="key">{{ label }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

      <ion-list v-for="month in months" :key="month.key" inset>
        <ion-list-header>
          <ion-label class="month-label">{{ month.label }}</ion-label>
          <ion-note>{{ fmt(month.total) }}</ion-note>
        </ion-list-header>
        <ion-item v-for="e in month.expenses" :key="e.id" button :detail="false" @click="emit('edit', e)">
          <ion-icon slot="start" :icon="CATEGORY_ICONS[e.category]" color="medium" />
          <ion-label class="ion-text-wrap">
            <h2>{{ e.title || EXPENSE_CATEGORY_LABELS[e.category] }}</h2>
            <p>{{ fmtDate(e.date) }} · {{ EXPENSE_CATEGORY_LABELS[e.category] }}</p>
            <p v-for="item in e.items ?? []" :key="item.id">{{ itemLine(item, fmt) }}</p>
            <p v-if="e.recurrence || e.photos?.length || e.masterId">
              <template v-if="e.recurrence">↻ {{ e.recurrence.every === 'month' ? 'каждый месяц' : 'каждый год' }}</template>
              <template v-if="e.masterId && masterName(e.masterId)"> · {{ masterName(e.masterId) }}</template>
              <template v-if="e.photos?.length"> · {{ e.photos.length }} фото</template>
            </p>
          </ion-label>
          <ion-note slot="end">{{ fmt(e.amount) }}</ion-note>
          <ion-button
            slot="end"
            fill="clear"
            :color="confirmingDeleteId === e.id ? 'danger' : 'medium'"
            @click.stop="handleDeleteClick(e.id)"
          >
            {{ confirmingDeleteId === e.id ? 'Точно?' : 'Удалить' }}
          </ion-button>
        </ion-item>
      </ion-list>
      <ion-list v-if="months.length === 0" inset>
        <ion-item lines="none">
          <ion-label color="medium">{{ expenses.length === 0 ? 'Записей пока нет' : 'Ничего не найдено — измените запрос или категорию' }}</ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" fill="outline" class="ion-margin" @click="emit('addExpense')">
        <ion-icon slot="start" :icon="add" />
        Добавить расход
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.month-label {
  text-transform: capitalize;
}
</style>
