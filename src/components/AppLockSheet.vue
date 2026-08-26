<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonModal, IonNote, IonTitle, IonToolbar } from '@ionic/vue'
import { setPin } from '../utils/appLock'

const emit = defineEmits<{
  close: []
  saved: []
}>()

const step = ref<'enter' | 'confirm'>('enter')
const firstPin = ref('')
const value = ref('')
const mismatch = ref(false)

const isValid = computed(() => /^\d{4,6}$/.test(value.value))

async function handleNext() {
  if (!isValid.value) return

  if (step.value === 'enter') {
    firstPin.value = value.value
    value.value = ''
    step.value = 'confirm'
    return
  }

  if (value.value !== firstPin.value) {
    mismatch.value = true
    firstPin.value = ''
    value.value = ''
    step.value = 'enter'
    return
  }

  await setPin(firstPin.value)
  emit('saved')
}

function handleInput() {
  mismatch.value = false
}
</script>

<template>
  <ion-modal :is-open="true" :breakpoints="[0, 1]" :initial-breakpoint="1" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>{{ step === 'enter' ? 'Новый код-пароль' : 'Повторите код-пароль' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleNext">
            {{ step === 'enter' ? 'Далее' : 'Готово' }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="none">
          <ion-input
            v-model="value"
            label="Код-пароль, 4–6 цифр"
            label-placement="stacked"
            type="password"
            inputmode="numeric"
            autofocus
            @ion-input="handleInput"
          />
        </ion-item>
      </ion-list>
      <ion-note v-if="mismatch" color="danger" class="hint">Код-пароли не совпадают — попробуйте ещё раз</ion-note>
      <ion-note v-else color="medium" class="hint">Этот код будет запрашиваться при открытии приложения</ion-note>
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
