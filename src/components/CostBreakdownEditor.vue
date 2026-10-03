<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IonButton, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonSelect, IonSelectOption } from '@ionic/vue'
import { add, closeCircleOutline } from 'ionicons/icons'
import { currency, formatMoney } from '../utils/currency'
import { haptic } from '../utils/haptics'
import { EXPENSE_ITEM_KIND_LABELS, type ExpenseItem, type ExpenseItemKind } from '../types'

const props = defineProps<{
  modelValue: ExpenseItem[]
  /** The total the lines should add up to; null/0 when it isn't known yet. */
  total: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [items: ExpenseItem[]]
}>()

// Lines are edited as strings (so a half-typed number is fine) and emitted as
// parsed ExpenseItems. The parent's total stays the source of truth.
interface Draft {
  id: string
  kind: ExpenseItemKind
  name: string
  amount: string
}

const ITEM_KINDS = Object.keys(EXPENSE_ITEM_KIND_LABELS) as ExpenseItemKind[]
const drafts = ref<Draft[]>(props.modelValue.map((i) => ({ id: i.id, kind: i.kind, name: i.name, amount: String(i.amount) })))

function parseAmount(raw: string): number {
  return Number(raw.replace(/\s/g, '').replace(',', '.'))
}

const parsed = computed<ExpenseItem[]>(() =>
  drafts.value
    .map((i) => ({ id: i.id, kind: i.kind, name: i.name.trim(), amount: parseAmount(i.amount) }))
    .filter((i) => Number.isFinite(i.amount) && i.amount > 0 && (i.name !== '' || i.kind !== 'other')),
)

watch(parsed, (items) => emit('update:modelValue', items), { deep: true })

const sum = computed(() => parsed.value.reduce((s, i) => s + i.amount, 0))
const diff = computed(() => (props.total ? props.total - sum.value : 0))

function add_(kind: ExpenseItemKind) {
  haptic('tap')
  drafts.value.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, kind, name: '', amount: '' })
}

function remove(id: string) {
  haptic('delete')
  drafts.value = drafts.value.filter((i) => i.id !== id)
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>Из чего состоит сумма</ion-list-header>
    <template v-for="item in drafts" :key="item.id">
      <ion-item lines="none">
        <ion-select v-model="item.kind" label="Тип" interface="action-sheet" :interface-options="{ cancelText: 'Отмена' }">
          <ion-select-option v-for="k in ITEM_KINDS" :key="k" :value="k">{{ EXPENSE_ITEM_KIND_LABELS[k] }}</ion-select-option>
        </ion-select>
        <ion-button slot="end" fill="clear" color="medium" aria-label="Убрать позицию" @click="remove(item.id)">
          <ion-icon slot="icon-only" :icon="closeCircleOutline" />
        </ion-button>
      </ion-item>
      <ion-item>
        <ion-input
          v-model="item.name"
          aria-label="Название"
          :placeholder="item.kind === 'labor' ? 'Например, замена колодок' : item.kind === 'part' ? 'Например, колодки передние' : 'Название'"
          enterkeyhint="next"
        />
        <ion-input
          v-model="item.amount"
          slot="end"
          class="item-amount"
          :aria-label="`Стоимость, ${currency}`"
          inputmode="decimal"
          :placeholder="currency"
          enterkeyhint="next"
        />
      </ion-item>
    </template>
    <ion-item lines="none" class="add-row">
      <ion-button fill="clear" size="small" @click="add_('part')">
        <ion-icon slot="start" :icon="add" />
        Деталь
      </ion-button>
      <ion-button fill="clear" size="small" @click="add_('labor')">
        <ion-icon slot="start" :icon="add" />
        Работа
      </ion-button>
      <ion-button fill="clear" size="small" @click="add_('other')">
        <ion-icon slot="start" :icon="add" />
        Другое
      </ion-button>
    </ion-item>
    <ion-item v-if="drafts.length > 0" lines="none">
      <ion-label class="ion-text-wrap">
        <p>Расписано {{ formatMoney(sum) }}<template v-if="total"> из {{ formatMoney(total) }}</template></p>
        <p v-if="total && diff > 0">Не расписано: {{ formatMoney(diff) }}</p>
        <p v-else-if="total && diff < 0" class="over">Больше общей суммы на {{ formatMoney(-diff) }}</p>
      </ion-label>
    </ion-item>
  </ion-list>
</template>

<style scoped>
.item-amount {
  max-width: 110px;
  text-align: right;
}

.add-row ion-button {
  margin: 0;
}

.over {
  color: var(--ion-color-danger);
}
</style>
