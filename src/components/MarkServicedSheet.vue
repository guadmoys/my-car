<script setup lang="ts">
import { confirmDialog } from '../utils/confirmDialog'
import { currency } from '../utils/currency'
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import type { ExpenseItem } from '../types'
import CostBreakdownEditor from './CostBreakdownEditor.vue'
import MasterPicker from './MasterPicker.vue'
import ReceiptPhotoField from './ReceiptPhotoField.vue'

const props = defineProps<{
  itemName: string
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { cost?: number; receiptPhoto?: string; items?: ExpenseItem[]; masterId?: string }]
}>()

const cost = ref('')
const receiptPhoto = ref<string | undefined>(undefined)
const items = ref<ExpenseItem[]>([])
const masterId = ref<string | undefined>(undefined)

const costNumber = computed(() => Number(cost.value.replace(/\s/g, '').replace(',', '.')))
const costInvalid = computed(() => cost.value.trim() !== '' && (Number.isNaN(costNumber.value) || costNumber.value < 0))

function handleSave() {
  if (costInvalid.value) return
  const itemsSum = items.value.reduce((s, i) => s + i.amount, 0)
  // No total typed but the breakdown is filled: the total is the sum of its lines.
  const total = cost.value.trim() === '' ? (itemsSum > 0 ? itemsSum : undefined) : costNumber.value
  emit('save', { cost: total, receiptPhoto: receiptPhoto.value, items: items.value, masterId: masterId.value })
}

// Guards only the accidental paths (swipe-down, backdrop tap) — the explicit
// Отмена button still closes immediately, same as every other sheet. Note
// that dismissing here only discards the cost/receipt being attached — the
// "done" action itself hasn't happened yet, so there's no undo needed, just
// a heads-up before the entered cost is lost.
async function canDismiss(): Promise<boolean> {
  if (cost.value.trim() === '' && !receiptPhoto.value && items.value.length === 0) return true
  return confirmDialog('Введённые данные не будут сохранены. Закрыть?', { confirmText: 'Закрыть' })
}
</script>

<template>
  <ion-modal :is-open="true" :can-dismiss="canDismiss"
    @did-dismiss="emit('close')"
  >
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>«{{ props.itemName }}»</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="costInvalid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="full">
          <ion-input
            v-model="cost"
            :label="`Стоимость замены, ${currency} (необязательно)`"
            label-placement="stacked"
            type="text"
            enterkeyhint="next" inputmode="decimal"
            placeholder="—"
            autofocus
          />
        </ion-item>
      </ion-list>
      <ion-note v-if="costInvalid" color="danger" class="hint">Стоимость не может быть отрицательной</ion-note>
      <CostBreakdownEditor v-model="items" :total="cost.trim() !== '' && costNumber > 0 ? costNumber : null" />
      <MasterPicker v-model="masterId" />
      <ReceiptPhotoField v-model="receiptPhoto" />
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint {
  display: block;
  font-size: 13px;
  margin: 8px 32px 0;
}
</style>
