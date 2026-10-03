<script setup lang="ts">
import { currency } from '../utils/currency'
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  EXPENSE_CATEGORY_LABELS,
  type Expense,
  type ExpenseCategory,
  type ExpenseItem,
  type ExpensePayload,
} from '../types'
import CostBreakdownEditor from './CostBreakdownEditor.vue'
import MasterPicker from './MasterPicker.vue'
import PhotoGalleryField from './PhotoGalleryField.vue'
import ReceiptPhotoField from './ReceiptPhotoField.vue'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  expense: Expense | null
  lastCategory?: ExpenseCategory
}>()

const emit = defineEmits<{
  close: []
  save: [payload: ExpensePayload]
}>()

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]

const category = ref<ExpenseCategory>(props.expense?.category ?? props.lastCategory ?? 'insurance')
const title = ref(props.expense?.title ?? '')
const amount = ref(props.expense ? String(props.expense.amount) : '')
const dateIso = ref(new Date(props.expense?.date ?? Date.now()).toISOString())
const note = ref(props.expense?.note ?? '')
const receiptPhoto = ref<string | undefined>(props.expense?.receiptPhoto)
const maxDateIso = new Date().toISOString()

const photos = ref<string[]>([...(props.expense?.photos ?? [])])
const masterId = ref<string | undefined>(props.expense?.masterId)
const repeat = ref<'none' | 'month' | 'year'>(props.expense?.recurrence?.every ?? 'none')
const items = ref<ExpenseItem[]>(props.expense?.items ? props.expense.items.map((i) => ({ ...i })) : [])

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
    items: items.value,
    photos: photos.value,
    masterId: masterId.value,
    repeat: repeat.value === 'none' ? undefined : repeat.value,
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
        <ion-item>
          <ion-input
            v-model="amount"
            :label="`Сумма, ${currency}`"
            label-placement="stacked"
            inputmode="decimal"
            placeholder="0"
            :autofocus="!props.expense"
            enterkeyhint="next"
            class="amount-input"
          />
        </ion-item>
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
        <ion-item lines="none">
          <ion-input v-model="title" label="Название (необязательно)" label-placement="stacked" :placeholder="EXPENSE_CATEGORY_LABELS[category]" enterkeyhint="done" />
        </ion-item>
      </ion-list>

      <CostBreakdownEditor v-model="items" :total="isValid ? amountNumber : null" />

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
          <ion-textarea v-model="note" label="Комментарий (необязательно)" label-placement="stacked" placeholder="—" :auto-grow="true" />
        </ion-item>
      </ion-list>

      <MasterPicker v-model="masterId" />

      <ion-list inset>
        <ion-item lines="none">
          <ion-select v-model="repeat" label="Повторять" interface="action-sheet" :interface-options="{ cancelText: 'Отмена' }">
            <ion-select-option value="none">Не повторять</ion-select-option>
            <ion-select-option value="month">Каждый месяц</ion-select-option>
            <ion-select-option value="year">Каждый год</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>
      <ion-note v-if="repeat !== 'none'" color="medium" class="hint">
        Следующие записи появятся сами в тот же день {{ repeat === 'month' ? 'каждого месяца' : 'каждого года' }}
      </ion-note>

      <ReceiptPhotoField v-model="receiptPhoto" />
      <PhotoGalleryField v-model="photos" :label="category === 'damage' ? 'Фото повреждений' : 'Добавить фото'" />
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

.amount-input {
  --padding-top: 4px;
  font-size: 20px;
  font-weight: 600;
}

.hint {
  display: block;
  font-size: 12px;
  margin: 6px 32px;
}
</style>
