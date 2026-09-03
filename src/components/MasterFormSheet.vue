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
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import type { Master } from '../types'

const props = defineProps<{
  master: Master | null
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { name: string; phone?: string; cardNumber?: string; link?: string; specialty?: string }]
}>()

const name = ref(props.master?.name ?? '')
const phone = ref(props.master?.phone ?? '')
const cardNumber = ref(props.master?.cardNumber ?? '')
const link = ref(props.master?.link ?? '')
const specialty = ref(props.master?.specialty ?? '')

const isValid = computed(() => name.value.trim().length > 0)

function handleSave() {
  if (!isValid.value) return
  emit('save', {
    name: name.value.trim(),
    phone: phone.value.trim() || undefined,
    cardNumber: cardNumber.value.trim() || undefined,
    link: link.value.trim() || undefined,
    specialty: specialty.value.trim() || undefined,
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
        <ion-title>{{ props.master ? 'Мастер' : 'Новый мастер' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item>
          <ion-input v-model="name" label="Имя" label-placement="stacked" placeholder="Например, Сергей" />
        </ion-item>
        <ion-item>
          <ion-input
            v-model="specialty"
            label="Чем занимается (необязательно)"
            label-placement="stacked"
            placeholder="Например, Развал-схождение"
          />
        </ion-item>
        <ion-item>
          <ion-input
            v-model="phone"
            label="Телефон (необязательно)"
            label-placement="stacked"
            type="tel"
            inputmode="tel"
            placeholder="+7 900 000-00-00"
          />
        </ion-item>
        <ion-item>
          <ion-input
            v-model="cardNumber"
            label="Номер карты для оплаты (необязательно)"
            label-placement="stacked"
            inputmode="numeric"
            placeholder="0000 0000 0000 0000"
          />
        </ion-item>
        <ion-item lines="none">
          <ion-input
            v-model="link"
            label="Ссылка (необязательно)"
            label-placement="stacked"
            type="url"
            placeholder="Telegram, Avito, VK..."
          />
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
