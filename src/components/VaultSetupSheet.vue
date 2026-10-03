<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonProgressBar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { copyOutline, downloadOutline } from 'ionicons/icons'
import { normalizeRecoveryCode, passphraseBits, passphraseProblem, type CreatedVault } from '../utils/vault'
import { cancelPreparedEncryption, commitEncryption, prepareEncryption } from '../utils/vaultActions'
import { haptic } from '../utils/haptics'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  close: []
  done: []
}>()

type Step = 'intro' | 'passphrase' | 'recovery' | 'working' | 'done'
const step = ref<Step>('intro')
const passphrase = ref('')
const passphrase2 = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const created = ref<CreatedVault | null>(null)
const lastGroup = ref('')
const progress = ref({ done: 0, total: 0 })
const toast = useToast()

const problem = computed(() => (passphrase.value ? passphraseProblem(passphrase.value) : null))
const strength = computed(() => Math.min(1, passphraseBits(passphrase.value) / 80))
const strengthColor = computed(() => (strength.value < 0.55 ? 'danger' : strength.value < 0.8 ? 'warning' : 'success'))
const canContinue = computed(() => passphrase.value !== '' && !problem.value && passphrase.value === passphrase2.value)

// The user proves they wrote the code down by typing its last group, so a skipped save is caught now, not after a lost passphrase.
const recoveryConfirmed = computed(() => {
  const code = created.value?.recoveryCode
  if (!code) return false
  return normalizeRecoveryCode(lastGroup.value) === normalizeRecoveryCode(code).slice(-4)
})

async function toRecovery() {
  if (!canContinue.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    created.value = await prepareEncryption(passphrase.value)
    step.value = 'recovery'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось создать ключи'
  } finally {
    busy.value = false
  }
}

async function copyCode() {
  if (!created.value) return
  try {
    await navigator.clipboard.writeText(created.value.recoveryCode)
    haptic('success')
    toast.show('Ключ скопирован — сохраните его в менеджере паролей')
  } catch {
    toast.show('Не удалось скопировать — перепишите ключ вручную')
  }
}

function downloadCode() {
  if (!created.value) return
  const text = `Моя машина — ключ восстановления\n\n${created.value.recoveryCode}\n\nХраните отдельно от телефона. Он открывает зашифрованные данные, если забыт пароль.\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'moya-mashina-recovery-key.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function encryptNow() {
  if (!created.value || !recoveryConfirmed.value || busy.value) return
  busy.value = true
  step.value = 'working'
  try {
    await commitEncryption(created.value, (done, total) => (progress.value = { done, total }))
    haptic('success')
    created.value = null
    passphrase.value = ''
    passphrase2.value = ''
    step.value = 'done'
  } catch (e) {
    haptic('warning')
    error.value = e instanceof Error ? e.message : 'Не удалось зашифровать данные'
    step.value = 'recovery'
  } finally {
    busy.value = false
  }
}

function close() {
  if (step.value === 'working') return
  if (step.value !== 'done') cancelPreparedEncryption()
  created.value = null
  if (step.value === 'done') emit('done')
  else emit('close')
}

onBeforeUnmount(() => {
  if (step.value !== 'done' && step.value !== 'working') cancelPreparedEncryption()
})
</script>

<template>
  <ion-modal :is-open="true" :can-dismiss="step !== 'working'" @did-dismiss="close">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button :disabled="step === 'working'" @click="close">{{ step === 'done' ? 'Закрыть' : 'Отмена' }}</ion-button>
        </ion-buttons>
        <ion-title>Шифрование данных</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <!-- 1. What it does -->
      <template v-if="step === 'intro'">
        <ion-list inset>
          <ion-list-header>Что изменится</ion-list-header>
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>
                Все данные на устройстве — машины, заправки, ТО, расходы, документы и фото — будут храниться в
                зашифрованном виде (AES-256). Резервные копии, файлы экспорта и облако тоже шифруются.
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
        <ion-list inset>
          <ion-list-header>Важно знать</ion-list-header>
          <ion-item lines="full">
            <ion-label class="ion-text-wrap"><p>При каждом входе нужен пароль. Отпечаток и Face ID для разблокировки не работают.</p></ion-label>
          </ion-item>
          <ion-item lines="full">
            <ion-label class="ion-text-wrap">
              <p><strong>Пароль нельзя сбросить.</strong> Если забыть и пароль, и ключ восстановления, данные не вернуть никому — в том числе нам.</p>
            </ion-label>
          </ion-item>
          <ion-item lines="full">
            <ion-label class="ion-text-wrap"><p>Код-пароль экрана будет отключён: его заменяет пароль шифрования.</p></ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>CSV-таблицы и PDF-отчёт, которые вы сами выгружаете, не шифруются — это обычные файлы.</p>
            </ion-label>
          </ion-item>
        </ion-list>
        <ion-button expand="block" class="ion-margin" @click="step = 'passphrase'">Продолжить</ion-button>
      </template>

      <!-- 2. Passphrase -->
      <template v-else-if="step === 'passphrase'">
        <ion-list inset>
          <ion-item>
            <ion-input
              v-model="passphrase"
              type="password"
              label="Пароль шифрования"
              label-placement="stacked"
              autocomplete="new-password"
              placeholder="Лучше фраза из нескольких слов"
              enterkeyhint="next"
            />
          </ion-item>
          <ion-item lines="none">
            <ion-input
              v-model="passphrase2"
              type="password"
              label="Повторите пароль"
              label-placement="stacked"
              autocomplete="new-password"
              enterkeyhint="done"
              @keyup.enter="toRecovery"
            />
          </ion-item>
        </ion-list>
        <div v-if="passphrase" class="strength-wrap">
          <ion-progress-bar :value="strength" :color="strengthColor" />
        </div>
        <ion-note v-if="problem" color="danger" class="hint">{{ problem }}</ion-note>
        <ion-note v-else-if="passphrase2 && passphrase !== passphrase2" color="danger" class="hint">Пароли не совпадают</ion-note>
        <ion-note v-else color="medium" class="hint">
          Минимум 10 символов. Чем длиннее и необычнее, тем лучше: «синий трактор любит дождь 47» надёжнее, чем «Qw3rty!».
        </ion-note>
        <ion-note v-if="error" color="danger" class="hint">{{ error }}</ion-note>
        <ion-button expand="block" class="ion-margin" :disabled="!canContinue || busy" @click="toRecovery">
          <ion-spinner v-if="busy" name="dots" />
          <template v-else>Далее</template>
        </ion-button>
      </template>

      <!-- 3. Recovery key -->
      <template v-else-if="step === 'recovery' && created">
        <ion-list inset>
          <ion-list-header>Ключ восстановления</ion-list-header>
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>Он открывает данные, если вы забудете пароль. Покажем один раз — сохраните в менеджере паролей или запишите на бумаге и храните отдельно от телефона.</p>
            </ion-label>
          </ion-item>
        </ion-list>
        <div class="recovery-code" aria-label="Ключ восстановления">{{ created.recoveryCode.split('-').slice(0, 4).join('-') }}<br />{{ created.recoveryCode.split('-').slice(4).join('-') }}</div>
        <div class="code-actions">
          <ion-button fill="outline" size="small" @click="copyCode">
            <ion-icon slot="start" :icon="copyOutline" />
            Скопировать
          </ion-button>
          <ion-button fill="outline" size="small" @click="downloadCode">
            <ion-icon slot="start" :icon="downloadOutline" />
            Скачать
          </ion-button>
        </div>
        <ion-list inset>
          <ion-item lines="none">
            <ion-input
              v-model="lastGroup"
              label="Последние 4 символа ключа"
              label-placement="stacked"
              placeholder="Проверка, что ключ сохранён"
              autocapitalize="characters"
              autocomplete="off"
              enterkeyhint="done"
            />
          </ion-item>
        </ion-list>
        <ion-note v-if="error" color="danger" class="hint">{{ error }}</ion-note>
        <ion-button expand="block" class="ion-margin" :disabled="!recoveryConfirmed || busy" @click="encryptNow">
          Зашифровать данные
        </ion-button>
      </template>

      <!-- 4. Working -->
      <template v-else-if="step === 'working'">
        <div class="working">
          <ion-spinner name="crescent" />
          <p>Шифрую данные…</p>
          <ion-progress-bar v-if="progress.total > 0" :value="progress.done / progress.total" />
          <ion-note color="medium">Не закрывайте приложение</ion-note>
        </div>
      </template>

      <!-- 5. Done -->
      <template v-else>
        <div class="working">
          <p><strong>Данные зашифрованы</strong></p>
          <ion-note color="medium">
            При следующем входе приложение попросит пароль. Ключ восстановления храните отдельно от телефона.
          </ion-note>
          <ion-button expand="block" class="ion-margin-top" @click="close">Готово</ion-button>
        </div>
      </template>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint {
  display: block;
  font-size: 13px;
  margin: 8px 32px 0;
}

.strength-wrap {
  margin: 0 32px;
}

.recovery-code {
  margin: 8px 16px;
  padding: 16px;
  border-radius: 12px;
  background: var(--ion-color-light);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-align: center;
  white-space: nowrap;
  user-select: all;
}

.code-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.working {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  padding: 48px 24px;
  text-align: center;
}
</style>
