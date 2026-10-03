<script setup lang="ts">
import { computed, ref } from 'vue'
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { copyOutline } from 'ionicons/icons'
import {
  VaultAuthError,
  changePassphrase,
  getAutoLockMinutes,
  lockVault,
  passphraseBits,
  passphraseProblem,
  rotateRecoveryCode,
  setAutoLockMinutes,
} from '../utils/vault'
import { disableEncryption } from '../utils/vaultActions'
import { haptic } from '../utils/haptics'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  close: []
  disabled: []
}>()

type Panel = 'menu' | 'change' | 'recovery' | 'disable'
const panel = ref<Panel>('menu')
const toast = useToast()

const current = ref('')
const next = ref('')
const next2 = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const newRecoveryCode = ref<string | null>(null)
const progress = ref({ done: 0, total: 0 })

const autoLock = ref(String(getAutoLockMinutes()))
const AUTOLOCK_OPTIONS = [
  { value: '0', label: 'Сразу при сворачивании' },
  { value: '1', label: 'Через 1 минуту' },
  { value: '5', label: 'Через 5 минут' },
  { value: '15', label: 'Через 15 минут' },
  { value: '60', label: 'Через час' },
]

const nextProblem = computed(() => (next.value ? passphraseProblem(next.value) : null))
const strength = computed(() => Math.min(1, passphraseBits(next.value) / 80))
const strengthColor = computed(() => (strength.value < 0.55 ? 'danger' : strength.value < 0.8 ? 'warning' : 'success'))

function open(p: Panel) {
  panel.value = p
  current.value = next.value = next2.value = ''
  error.value = null
  newRecoveryCode.value = null
}

function handleAutoLock(e: CustomEvent) {
  autoLock.value = String(e.detail.value)
  setAutoLockMinutes(Number(e.detail.value))
}

function lockNow() {
  haptic('tap')
  lockVault()
  emit('close')
}

function fail(e: unknown) {
  haptic('warning')
  error.value = e instanceof Error ? e.message : 'Что-то пошло не так'
}

async function submitChange() {
  if (busy.value) return
  error.value = null
  if (nextProblem.value) {
    error.value = nextProblem.value
    return
  }
  if (next.value !== next2.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  busy.value = true
  try {
    await changePassphrase({ passphrase: current.value }, next.value)
    haptic('success')
    toast.show('Пароль изменён')
    open('menu')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function submitRecovery() {
  if (busy.value || !current.value) return
  error.value = null
  busy.value = true
  try {
    newRecoveryCode.value = await rotateRecoveryCode(current.value)
    current.value = ''
    haptic('success')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function copyRecovery() {
  if (!newRecoveryCode.value) return
  try {
    await navigator.clipboard.writeText(newRecoveryCode.value)
    toast.show('Ключ скопирован')
  } catch {
    toast.show('Не удалось скопировать — перепишите ключ вручную')
  }
}

async function submitDisable() {
  if (busy.value || !current.value) return
  const ok = window.confirm('Данные снова будут храниться без шифрования. Отключить шифрование?')
  if (!ok) return
  error.value = null
  busy.value = true
  try {
    await disableEncryption({ passphrase: current.value }, (done, total) => (progress.value = { done, total }))
    haptic('success')
    toast.show('Шифрование отключено')
    emit('disabled')
  } catch (e) {
    fail(e instanceof VaultAuthError ? e : e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ion-modal :is-open="true" :can-dismiss="!busy" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button v-if="panel === 'menu'" :disabled="busy" @click="emit('close')">Закрыть</ion-button>
          <ion-button v-else :disabled="busy" @click="open('menu')">Назад</ion-button>
        </ion-buttons>
        <ion-title>Шифрование данных</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <template v-if="panel === 'menu'">
        <ion-list inset>
          <ion-list-header>Данные зашифрованы</ion-list-header>
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>AES-256, ключ защищён паролем (Argon2id). Резервные копии, экспорт и облако тоже шифруются.</p>
            </ion-label>
          </ion-item>
        </ion-list>
        <ion-list inset>
          <ion-item>
            <ion-select
              label="Блокировать"
              :value="autoLock"
              interface="action-sheet"
              :interface-options="{ cancelText: 'Отмена' }"
              @ion-change="handleAutoLock"
            >
              <ion-select-option v-for="o in AUTOLOCK_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item button :detail="false" lines="full" @click="lockNow"><ion-label>Заблокировать сейчас</ion-label></ion-item>
          <ion-item button :detail="true" lines="full" @click="open('change')"><ion-label>Сменить пароль</ion-label></ion-item>
          <ion-item button :detail="true" lines="none" @click="open('recovery')"><ion-label>Новый ключ восстановления</ion-label></ion-item>
        </ion-list>
        <ion-list inset>
          <ion-item button :detail="false" lines="none" @click="open('disable')">
            <ion-label color="danger">Отключить шифрование</ion-label>
          </ion-item>
        </ion-list>
      </template>

      <template v-else-if="panel === 'change'">
        <ion-list inset>
          <ion-item>
            <ion-input v-model="current" type="password" label="Текущий пароль" label-placement="stacked" autocomplete="current-password" />
          </ion-item>
          <ion-item>
            <ion-input v-model="next" type="password" label="Новый пароль" label-placement="stacked" autocomplete="new-password" />
          </ion-item>
          <ion-item lines="none">
            <ion-input
              v-model="next2"
              type="password"
              label="Повторите новый пароль"
              label-placement="stacked"
              autocomplete="new-password"
              @keyup.enter="submitChange"
            />
          </ion-item>
        </ion-list>
        <div v-if="next" class="strength-wrap"><ion-progress-bar :value="strength" :color="strengthColor" /></div>
        <ion-note v-if="nextProblem" color="danger" class="hint">{{ nextProblem }}</ion-note>
        <ion-note v-if="error" color="danger" class="hint">{{ error }}</ion-note>
        <ion-button expand="block" class="ion-margin" :disabled="busy || !current || !next" @click="submitChange">
          <ion-spinner v-if="busy" name="dots" />
          <template v-else>Сменить пароль</template>
        </ion-button>
      </template>

      <template v-else-if="panel === 'recovery'">
        <template v-if="!newRecoveryCode">
          <ion-list inset>
            <ion-item lines="none">
              <ion-label class="ion-text-wrap"><p>Старый ключ перестанет работать. Подтвердите паролем.</p></ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-input
                v-model="current"
                type="password"
                label="Пароль шифрования"
                label-placement="stacked"
                autocomplete="current-password"
                @keyup.enter="submitRecovery"
              />
            </ion-item>
          </ion-list>
          <ion-note v-if="error" color="danger" class="hint">{{ error }}</ion-note>
          <ion-button expand="block" class="ion-margin" :disabled="busy || !current" @click="submitRecovery">
            <ion-spinner v-if="busy" name="dots" />
            <template v-else>Выпустить новый ключ</template>
          </ion-button>
        </template>
        <template v-else>
          <ion-note color="medium" class="hint">Сохраните ключ — больше он показан не будет.</ion-note>
          <div class="recovery-code">{{ newRecoveryCode.split('-').slice(0, 4).join('-') }}<br />{{ newRecoveryCode.split('-').slice(4).join('-') }}</div>
          <div class="code-actions">
            <ion-button fill="outline" size="small" @click="copyRecovery">
              <ion-icon slot="start" :icon="copyOutline" />
              Скопировать
            </ion-button>
          </div>
          <ion-button expand="block" class="ion-margin" @click="open('menu')">Я сохранил(а) ключ</ion-button>
        </template>
      </template>

      <template v-else>
        <template v-if="busy">
          <div class="working">
            <ion-spinner name="crescent" />
            <p>Расшифровываю данные…</p>
            <ion-progress-bar v-if="progress.total > 0" :value="progress.done / progress.total" />
          </div>
        </template>
        <template v-else>
          <ion-list inset>
            <ion-item lines="none">
              <ion-label class="ion-text-wrap">
                <p>Все данные снова будут храниться на устройстве в открытом виде, а защита экрана вернётся к обычному код-паролю.</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-input
                v-model="current"
                type="password"
                label="Пароль шифрования"
                label-placement="stacked"
                autocomplete="current-password"
                @keyup.enter="submitDisable"
              />
            </ion-item>
          </ion-list>
          <ion-note v-if="error" color="danger" class="hint">{{ error }}</ion-note>
          <ion-button expand="block" color="danger" class="ion-margin" :disabled="!current" @click="submitDisable">
            Отключить шифрование
          </ion-button>
        </template>
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
