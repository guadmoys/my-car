<script setup lang="ts">
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
import ReceiptPhotoField from './ReceiptPhotoField.vue'

const props = defineProps<{
  itemName: string
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { cost?: number; receiptPhoto?: string }]
}>()

const cost = ref('')
const receiptPhoto = ref<string | undefined>(undefined)

const costNumber = computed(() => Number(cost.value.replace(/\s/g, '').replace(',', '.')))
const costInvalid = computed(() => cost.value.trim() !== '' && (Number.isNaN(costNumber.value) || costNumber.value < 0))

function handleSave() {
  if (costInvalid.value) return
  emit('save', { cost: cost.value.trim() === '' ? undefined : costNumber.value, receiptPhoto: receiptPhoto.value })
}
</script>

<template>
  <ion-modal :is-open="true" :breakpoints="[0, 1]" :initial-breakpoint="1" @did-dismiss="emit('close')">
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
            label="Стоимость замены, ₽ (необязательно)"
            label-placement="stacked"
            type="text"
            inputmode="decimal"
            placeholder="—"
            autofocus
          />
        </ion-item>
      </ion-list>
      <ion-note v-if="costInvalid" color="danger" class="hint">Стоимость не может быть отрицательной</ion-note>
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
