<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IonButton, IonContent, IonIcon, IonInput, IonNote, IonPage } from '@ionic/vue'
import { carSportOutline, fingerPrintOutline, lockClosedOutline } from 'ionicons/icons'
import { isBiometricEnabled, verifyBiometric, verifyPin } from '../utils/appLock'
import { haptic } from '../utils/haptics'

const emit = defineEmits<{
  unlock: []
}>()

const pin = ref('')
const error = ref(false)
const checkingBiometric = ref(false)
const biometricAvailable = ref(isBiometricEnabled())

async function tryBiometric() {
  if (!biometricAvailable.value || checkingBiometric.value) return
  checkingBiometric.value = true
  const ok = await verifyBiometric()
  checkingBiometric.value = false
  if (ok) {
    haptic('success')
    emit('unlock')
  }
}

onMounted(() => {
  if (biometricAvailable.value) tryBiometric()
})

async function submitPin() {
  if (pin.value.trim() === '') return
  const ok = await verifyPin(pin.value)
  if (ok) {
    haptic('success')
    emit('unlock')
  } else {
    haptic('warning')
    error.value = true
    pin.value = ''
  }
}

function handleInput() {
  error.value = false
}
</script>

<template>
  <ion-page>
    <ion-content class="lock-content" :fullscreen="true">
      <div class="lock-body">
        <div class="app-icon">
          <ion-icon :icon="carSportOutline" />
        </div>
        <h1>Моя машина</h1>

        <div class="pin-row">
          <ion-icon :icon="lockClosedOutline" color="medium" />
          <ion-input
            v-model="pin"
            type="password"
            inputmode="numeric"
            placeholder="Код-пароль"
            autofocus
            :class="{ 'ion-invalid': error }"
            @ion-input="handleInput"
            @keyup.enter="submitPin"
          />
        </div>
        <ion-note v-if="error" color="danger" class="hint">Неверный код-пароль</ion-note>

        <ion-button expand="block" :disabled="pin.trim() === ''" @click="submitPin">Войти</ion-button>

        <ion-button v-if="biometricAvailable" fill="clear" :disabled="checkingBiometric" @click="tryBiometric">
          <ion-icon slot="start" :icon="fingerPrintOutline" />
          Face ID / отпечаток
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.lock-content {
  --background: var(--ion-color-light);
}

.lock-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  max-width: 320px;
  margin: 0 auto;
  padding: 25vh 24px 24px;
  text-align: center;
}

.app-icon {
  align-self: center;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  margin-bottom: 4px;
}

.app-icon ion-icon {
  font-size: 32px;
}

h1 {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 20px;
}

.pin-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--ion-item-background, #fff);
  border-radius: 12px;
  padding: 4px 14px;
}

.hint {
  display: block;
  font-size: 13px;
  margin-top: -6px;
}
</style>
