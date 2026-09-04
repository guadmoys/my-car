<script setup lang="ts">
import { ref } from 'vue'
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
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { add, alertCircleOutline, carSportOutline, cardOutline, receiptOutline, shieldCheckmarkOutline, walletOutline } from 'ionicons/icons'
import { EXPENSE_CATEGORY_LABELS, type Expense, type ExpenseCategory, type ExpenseStatus } from '../types'

const props = defineProps<{
  expenses: Expense[]
  expenseStatuses: ExpenseStatus[]
  total: number
}>()

const emit = defineEmits<{
  close: []
  edit: [expense: Expense]
  delete: [id: string]
  addExpense: []
}>()

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

function statusFor(expense: Expense): ExpenseStatus | undefined {
  return props.expenseStatuses.find((s) => s.expense.id === expense.id)
}

function renewalLabel(status: ExpenseStatus | undefined): string | null {
  if (!status) return null
  if (status.isDue) return `Продление просрочено`
  if (status.isSoon) return `Продлить через ${status.remainingDays} дн.`
  return null
}

function fmt(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
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
    </ion-header>
    <ion-content>
      <ion-list v-if="expenses.length > 0" inset>
        <ion-item lines="none">
          <ion-label><strong>Итого</strong></ion-label>
          <ion-note slot="end" color="primary"><strong>{{ fmt(total) }}</strong></ion-note>
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-list-header v-if="expenses.length > 0">Записи</ion-list-header>
        <ion-item v-for="e in expenses" :key="e.id" button :detail="false" @click="emit('edit', e)">
          <ion-icon slot="start" :icon="CATEGORY_ICONS[e.category]" color="medium" />
          <ion-label>
            <h2>{{ e.title || EXPENSE_CATEGORY_LABELS[e.category] }}</h2>
            <p>{{ fmtDate(e.date) }}</p>
            <p v-if="renewalLabel(statusFor(e))" :class="statusFor(e)?.isDue ? 'due-text' : 'soon-text'">
              {{ renewalLabel(statusFor(e)) }}
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
        <ion-item v-if="expenses.length === 0" lines="none">
          <ion-label color="medium">Записей пока нет</ion-label>
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
.due-text {
  color: var(--ion-color-danger);
}

.soon-text {
  color: var(--ion-color-tertiary);
}
</style>
