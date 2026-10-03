<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IonButton, IonContent, IonIcon, IonInput, IonNote, IonPage, IonSpinner } from '@ionic/vue'
import { carSportOutline, keyOutline, lockClosedOutline } from 'ionicons/icons'
import {
  VaultAuthError,
  changePassphrase,
  normalizeRecoveryCode,
  passphraseBits,
  passphraseProblem,
  unlockVault,
  vaultLockoutRemainingMs,
} from '../utils/vault'
import { haptic } from '../utils/haptics'

const emit = defineEmits<{
  unlock: []
}>()

type Mode = 'passphrase' | 'recovery' | 'new-passphrase'
const mode = ref<Mode>('passphrase')
const passphrase = ref('')
const recoveryCode = ref('')
const newPassphrase = ref('')
const newPassphrase2 = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

const lockoutSeconds = ref(Math.ceil(vaultLockoutRemainingMs() / 1000))
let timer: ReturnType<typeof setInterval> | undefined

function startTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    lockoutSeconds.value = Math.ceil(vaultLockoutRemainingMs() / 1000)
    if (lockoutSeconds.value <= 0 && timer) clearInterval(timer)
  }, 1000)
}

onMounted(() => {
  if (lockoutSeconds.value > 0) startTimer()
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

async function submit() {
  if (busy.value || lockoutSeconds.value > 0) return
  error.value = null
  busy.value = true
  try {
    if (mode.value === 'passphrase') {
      if (!passphrase.value) return
      await unlockVault({ passphrase: passphrase.value })
      haptic('success')
      emit('unlock')
    } else if (mode.value === 'recovery') {
      if (normalizeRecoveryCode(recoveryCode.value).length < 32) {
        error.value = 'Ключ восстановления состоит из 32 символов'
        return
      }
      await unlockVault({ recoveryCode: recoveryCode.value })
      haptic('success')
      // The old passphrase is forgotten: require a new one before going on.
      mode.value = 'new-passphrase'
    } else {
      const problem = passphraseProblem(newPassphrase.value)
      if (problem) {
        error.value = problem
        return
      }
      if (newPassphrase.value !== newPassphrase2.value) {
        error.value = 'Пароли не совпадают'
        return
      }
      await changePassphrase({ recoveryCode: recoveryCode.value }, newPassphrase.value)
      recoveryCode.value = ''
      haptic('success')
      emit('unlock')
    }
  } catch (e) {
    haptic('warning')
    error.value = e instanceof VaultAuthError || e instanceof Error ? e.message : 'Не удалось разблокировать'
    passphrase.value = ''
    lockoutSeconds.value = Math.ceil(vaultLockoutRemainingMs() / 1000)
    if (lockoutSeconds.value > 0) startTimer()
  } finally {
    busy.value = false
  }
}

const strength = computed(() => Math.min(1, passphraseBits(newPassphrase.value) / 80))
const title = computed(() =>
  mode.value === 'passphrase' ? 'Данные зашифрованы' : mode.value === 'recovery' ? 'Ключ восстановления' : 'Новый пароль',
)
</script>

<template>
  <ion-page>
    <ion-content class="lock-content" :fullscreen="true">
      <div class="lock-body">
        <div class="app-icon">
          <ion-icon :icon="carSportOutline" />
        </div>
        <h1>Моя машина</h1>
        <p class="subtitle">{{ title }}</p>

        <template v-if="mode === 'passphrase'">
          <div class="pin-row">
            <ion-icon :icon="lockClosedOutline" color="medium" />
            <ion-input
              v-model="passphrase"
              type="password"
              enterkeyhint="done"
              placeholder="Пароль шифрования"
              autocomplete="current-password"
              aria-label="Пароль шифрования"
              @keyup.enter="submit"
            />
          </div>
        </template>

        <template v-else-if="mode === 'recovery'">
          <div class="pin-row">
            <ion-icon :icon="keyOutline" color="medium" />
            <ion-input
              v-model="recoveryCode"
              enterkeyhint="done"
              placeholder="XXXX-XXXX-XXXX-…"
              autocapitalize="characters"
              autocomplete="off"
              aria-label="Ключ восстановления"
              @keyup.enter="submit"
            />
          </div>
        </template>

        <template v-else>
          <div class="pin-row">
            <ion-icon :icon="lockClosedOutline" color="medium" />
            <ion-input v-model="newPassphrase" type="password" placeholder="Новый пароль" aria-label="Новый пароль" />
          </div>
          <div class="strength" aria-hidden="true"><div class="bar" :style="{ width: `${strength * 100}%` }" /></div>
          <div class="pin-row">
            <ion-icon :icon="lockClosedOutline" color="medium" />
            <ion-input
              v-model="newPassphrase2"
              type="password"
              placeholder="Повторите пароль"
              aria-label="Повторите пароль"
              @keyup.enter="submit"
            />
          </div>
        </template>

        <ion-note v-if="lockoutSeconds > 0" color="danger" class="hint">
          Слишком много попыток. Повторите через {{ lockoutSeconds }} с
        </ion-note>
        <ion-note v-else-if="error" color="danger" class="hint">{{ error }}</ion-note>

        <ion-button expand="block" :disabled="busy || lockoutSeconds > 0" @click="submit">
          <ion-spinner v-if="busy" name="dots" />
          <template v-else>{{ mode === 'passphrase' ? 'Разблокировать' : mode === 'recovery' ? 'Войти по ключу' : 'Сохранить пароль' }}</template>
        </ion-button>

        <ion-button v-if="mode === 'passphrase'" fill="clear" size="small" @click="(mode = 'recovery'), (error = null)">
          Забыли пароль? Ввести ключ восстановления
        </ion-button>
        <ion-button v-else-if="mode === 'recovery'" fill="clear" size="small" @click="(mode = 'passphrase'), (error = null)">
          Назад
        </ion-button>
        <ion-note v-if="mode === 'passphrase'" color="medium" class="hint small">
          Пароль нельзя сбросить: без него и без ключа восстановления данные не открыть
        </ion-note>
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
  max-width: 340px;
  margin: 0 auto;
  padding: 18vh 24px 24px;
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
  font-size: 34px;
}

h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.subtitle {
  margin: 0 0 8px;
  color: var(--ion-color-medium);
}

.pin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-radius: 14px;
  background: var(--ion-item-background, #fff);
}

.hint {
  display: block;
  font-size: 13px;
}

.hint.small {
  font-size: 12px;
}

.strength {
  height: 4px;
  border-radius: 2px;
  background: var(--ion-color-step-150, rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.strength .bar {
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 0.2s;
}
</style>
