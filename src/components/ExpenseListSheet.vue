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
import { add, alertCircleOutline, carSportOutline, cardOutline, receiptOutline, shieldCheckmarkOutline, walletOutline } from 'ionicons/icons'
import { EXPENSE_CATEGORY_LABELS, type Expense, type ExpenseCategory } from '../types'

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

      <ion-list inset>
        <ion-list-header v-if="filteredExpenses.length > 0">Записи</ion-list-header>
        <ion-item v-for="e in filteredExpenses" :key="e.id" button :detail="false" @click="emit('edit', e)">
          <ion-icon slot="start" :icon="CATEGORY_ICONS[e.category]" color="medium" />
          <ion-label>
            <h2>{{ e.title || EXPENSE_CATEGORY_LABELS[e.category] }}</h2>
            <p>{{ fmtDate(e.date) }}</p>
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
        <ion-item v-if="filteredExpenses.length === 0" lines="none">
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
