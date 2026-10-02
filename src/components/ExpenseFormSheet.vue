<script setup lang="ts">
import { currency, formatMoney } from '../utils/currency'
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { add, closeCircleOutline } from 'ionicons/icons'
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_ITEM_KIND_LABELS,
  type Expense,
  type ExpenseCategory,
  type ExpenseItem,
  type ExpenseItemKind,
} from '../types'
import ReceiptPhotoField from './ReceiptPhotoField.vue'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  expense: Expense | null
  lastCategory?: ExpenseCategory
}>()

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      category: ExpenseCategory
      title?: string
      amount: number
      date: number
      note?: string
      receiptPhoto?: string
      items?: ExpenseItem[]
    },
  ]
}>()

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]

const category = ref<ExpenseCategory>(props.expense?.category ?? props.lastCategory ?? 'insurance')
const title = ref(props.expense?.title ?? '')
const amount = ref(props.expense ? String(props.expense.amount) : '')
const dateIso = ref(new Date(props.expense?.date ?? Date.now()).toISOString())
const note = ref(props.expense?.note ?? '')
const receiptPhoto = ref<string | undefined>(props.expense?.receiptPhoto)
const maxDateIso = new Date().toISOString()

// Breakdown lines are edited as strings (so a half-typed number is fine) and
// converted to ExpenseItem on save. The total above stays the source of truth.
interface DraftItem {
  id: string
  kind: ExpenseItemKind
  name: string
  amount: string
}
const ITEM_KINDS = Object.keys(EXPENSE_ITEM_KIND_LABELS) as ExpenseItemKind[]
const draftItems = ref<DraftItem[]>(
  (props.expense?.items ?? []).map((i) => ({ id: i.id, kind: i.kind, name: i.name, amount: String(i.amount) })),
)

function parseAmount(raw: string): number {
  return Number(raw.replace(/\s/g, '').replace(',', '.'))
}

function addItem(kind: ExpenseItemKind) {
  haptic('tap')
  draftItems.value.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, kind, name: '', amount: '' })
}

function removeItem(id: string) {
  haptic('delete')
  draftItems.value = draftItems.value.filter((i) => i.id !== id)
}

const itemsSum = computed(() =>
  draftItems.value.reduce((sum, i) => {
    const n = parseAmount(i.amount)
    return sum + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0),
)
const itemsDiff = computed(() => (Number.isFinite(amountNumber.value) ? amountNumber.value - itemsSum.value : 0))

const amountNumber = computed(() => Number(amount.value.replace(/\s/g, '').replace(',', '.')))

const isValid = computed(() => amount.value.trim() !== '' && !Number.isNaN(amountNumber.value) && amountNumber.value > 0)

function selectCategory(c: ExpenseCategory) {
  haptic('tap')
  category.value = c
}

function handleSave() {
  if (!isValid.value) return
  emit('save', {
    category: category.value,
    title: title.value.trim() || undefined,
    amount: amountNumber.value,
    date: new Date(dateIso.value).getTime(),
    note: note.value.trim() || undefined,
    receiptPhoto: receiptPhoto.value,
    items: draftItems.value
      .map((i) => ({ id: i.id, kind: i.kind, name: i.name.trim(), amount: parseAmount(i.amount) }))
      .filter((i) => Number.isFinite(i.amount) && i.amount > 0 && (i.name !== '' || i.kind !== 'other')),
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
        <ion-title>{{ props.expense ? 'Расход' : 'Новый расход' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="full">
          <ion-label class="ion-text-wrap">
            <p>Категория</p>
            <div class="category-chips">
              <ion-chip
                v-for="c in CATEGORIES"
                :key="c"
                :color="category === c ? 'primary' : undefined"
                :outline="category !== c"
                @click="selectCategory(c)"
              >
                {{ EXPENSE_CATEGORY_LABELS[c] }}
              </ion-chip>
            </div>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-input v-model="title" label="Название (необязательно)" label-placement="stacked" :placeholder="EXPENSE_CATEGORY_LABELS[category]" />
        </ion-item>
        <ion-item lines="none">
          <ion-input v-model="amount" :label="`Сумма, ${currency}`" label-placement="stacked" inputmode="decimal" placeholder="0" />
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-list-header>Из чего состоит сумма</ion-list-header>
        <template v-for="item in draftItems" :key="item.id">
          <ion-item lines="none">
            <ion-select v-model="item.kind" label="Тип" interface="action-sheet" :interface-options="{ cancelText: 'Отмена' }">
              <ion-select-option v-for="k in ITEM_KINDS" :key="k" :value="k">{{ EXPENSE_ITEM_KIND_LABELS[k] }}</ion-select-option>
            </ion-select>
            <ion-button slot="end" fill="clear" color="medium" aria-label="Убрать позицию" @click="removeItem(item.id)">
              <ion-icon slot="icon-only" :icon="closeCircleOutline" />
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-input
              v-model="item.name"
              label="Название"
              label-placement="stacked"
              :placeholder="item.kind === 'labor' ? 'Например, покраска бампера' : item.kind === 'part' ? 'Например, бампер передний' : '—'"
            />
          </ion-item>
          <ion-item>
            <ion-input v-model="item.amount" :label="`Стоимость, ${currency}`" label-placement="stacked" inputmode="decimal" placeholder="0" />
          </ion-item>
        </template>
        <ion-item lines="none" class="add-row">
          <ion-button fill="clear" size="small" @click="addItem('part')">
            <ion-icon slot="start" :icon="add" />
            Деталь
          </ion-button>
          <ion-button fill="clear" size="small" @click="addItem('labor')">
            <ion-icon slot="start" :icon="add" />
            Работа
          </ion-button>
          <ion-button fill="clear" size="small" @click="addItem('other')">
            <ion-icon slot="start" :icon="add" />
            Другое
          </ion-button>
        </ion-item>
        <ion-item v-if="draftItems.length > 0" lines="none">
          <ion-label class="ion-text-wrap">
            <p>Расписано {{ formatMoney(itemsSum) }} из {{ formatMoney(isValid ? amountNumber : 0) }}</p>
            <p v-if="isValid && itemsDiff > 0" class="diff">Не расписано: {{ formatMoney(itemsDiff) }}</p>
            <p v-else-if="isValid && itemsDiff < 0" class="diff over">Больше общей суммы на {{ formatMoney(-itemsDiff) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-item lines="none">
          <ion-label>Дата</ion-label>
          <ion-datetime-button slot="end" datetime="expense-date" />
        </ion-item>
      </ion-list>
      <ion-modal :keep-contents-mounted="true">
        <ion-datetime id="expense-date" v-model="dateIso" presentation="date" locale="ru-RU" :max="maxDateIso" />
      </ion-modal>

      <ion-note v-if="category === 'insurance' || category === 'tax'" color="medium" class="hint">
        Срок действия страховки, техосмотра или налога добавляйте в разделе «Документы» — там же напомним о продлении
      </ion-note>

      <ion-list inset>
        <ion-item lines="none">
          <ion-input v-model="note" label="Комментарий (необязательно)" label-placement="stacked" placeholder="—" />
        </ion-item>
      </ion-list>

      <ReceiptPhotoField v-model="receiptPhoto" />
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.add-row ion-button {
  margin: 0;
}

.diff {
  color: var(--ion-color-medium);
}

.diff.over {
  color: var(--ion-color-danger);
}

.hint {
  display: block;
  font-size: 12px;
  margin: 6px 32px;
}
</style>
