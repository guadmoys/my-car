<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonModal, IonNote, IonTitle, IonToolbar } from '@ionic/vue'

const props = defineProps<{
  title: string
  subtitle: string
  currentCost?: number
}>()

const emit = defineEmits<{
  close: []
  save: [cost: number | null]
}>()

const value = ref(props.currentCost !== undefined ? String(props.currentCost) : '')

const costNumber = computed(() => Number(value.value.replace(/\s/g, '').replace(',', '.')))
const isValid = computed(() => value.value.trim() === '' || (!Number.isNaN(costNumber.value) && costNumber.value >= 0))

function handleSave() {
  if (!isValid.value) return
  emit('save', value.value.trim() === '' ? null : costNumber.value)
}
</script>

<template>
  <ion-modal :is-open="true" :breakpoints="[0, 1]" :initial-breakpoint="1" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>Стоимость</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="none">
          <ion-input
            v-model="value"
            :label="`${title} · ${subtitle}`"
            label-placement="stacked"
            type="text"
            inputmode="decimal"
            placeholder="Без стоимости"
            autofocus
          />
        </ion-item>
      </ion-list>
      <ion-note color="medium" class="hint">Оставьте поле пустым, чтобы убрать стоимость</ion-note>
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
