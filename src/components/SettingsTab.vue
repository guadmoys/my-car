<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  IonAvatar,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
  type SegmentCustomEvent,
  type ToggleCustomEvent,
} from '@ionic/vue'
import {
  calendarOutline,
  carOutline,
  carSportOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  closeCircleOutline,
  documentTextOutline,
  downloadOutline,
  eyeOutline,
  fingerPrintOutline,
  keyOutline,
  lockClosedOutline,
  notificationsOutline,
  refreshOutline,
  syncOutline,
  trashOutline,
  waterOutline,
} from 'ionicons/icons'
import type { Car } from '../types'
import { CAR_MAKES, modelsForMake } from '../data/carCatalog'
import PickerSheet from './PickerSheet.vue'
import SettingsIconBadge from './SettingsIconBadge.vue'
import AppLockSheet from './AppLockSheet.vue'
import {
  getNotificationPermission,
  isNotificationApiSupported,
  isNotificationsEnabled,
  requestNotificationPermission,
  setNotificationsEnabled,
} from '../utils/notifications'
import {
  disableBiometric,
  disableLock,
  isBiometricEnabled,
  isLockEnabled,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
} from '../utils/appLock'
import {
  DATE_FORMAT_OPTIONS,
  formatDate,
  getDateFormat,
  isShowYearEnabled,
  setDateFormat,
  setShowYearEnabled,
} from '../utils/dateFormat'
import type { DateFormatId } from '../utils/dateFormat'
import { checkForUpdate } from '../utils/appUpdate'
import { handlePullToRefresh } from '../utils/pullToRefresh'
import { useToast } from '../composables/useToast'
import { haptic } from '../utils/haptics'
import { useCloudSync } from '../composables/useCloudSync'
import type { CloudProvider } from '../utils/cloudSync'

const props = defineProps<{
  car: Car
  carCount: number
  importError: string | null
}>()

const emit = defineEmits<{
  save: [payload: { make: string; model: string; year: number; tankCapacity?: number }]
  deleteCar: []
  export: []
  import: [file: File]
  openCarSwitcher: []
  sharePassport: []
  notificationsEnabled: []
}>()

const make = ref(props.car.make)
const model = ref(props.car.model)
const year = ref(String(props.car.year))
const tankCapacity = ref(props.car.tankCapacity !== undefined ? String(props.car.tankCapacity) : '')
const confirmingDelete = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const activePicker = ref<'make' | 'model' | null>(null)
const modelOptions = computed(() => modelsForMake(make.value))

watch(
  () => props.car.id,
  () => {
    make.value = props.car.make
    model.value = props.car.model
    year.value = String(props.car.year)
    tankCapacity.value = props.car.tankCapacity !== undefined ? String(props.car.tankCapacity) : ''
    confirmingDelete.value = false
  },
)

const notificationsSupported = isNotificationApiSupported()
const notificationsOn = ref(isNotificationsEnabled() && getNotificationPermission() === 'granted')
const notificationsBlocked = ref(getNotificationPermission() === 'denied')

async function handleToggleNotifications(checked: boolean) {
  if (!checked) {
    setNotificationsEnabled(false)
    notificationsOn.value = false
    return
  }
  const permission = await requestNotificationPermission()
  if (permission === 'granted') {
    setNotificationsEnabled(true)
    notificationsOn.value = true
    notificationsBlocked.value = false
    emit('notificationsEnabled')
  } else {
    setNotificationsEnabled(false)
    notificationsOn.value = false
    notificationsBlocked.value = permission === 'denied'
  }
}

const lockOn = ref(isLockEnabled())
const biometricOn = ref(isBiometricEnabled())
const biometricSupported = ref(false)
const showAppLockSheet = ref(false)

onMounted(async () => {
  biometricSupported.value = await isPlatformAuthenticatorAvailable()
})

function handleTogglePasscode(checked: boolean) {
  if (checked) {
    showAppLockSheet.value = true
    return
  }
  disableLock()
  lockOn.value = false
  biometricOn.value = false
}

function handleAppLockSaved() {
  showAppLockSheet.value = false
  lockOn.value = true
}

async function handleToggleBiometric(checked: boolean) {
  if (!checked) {
    disableBiometric()
    biometricOn.value = false
    return
  }
  const ok = await registerBiometric()
  biometricOn.value = ok
}

const dateFormat = ref<DateFormatId>(getDateFormat())
const showYear = ref(isShowYearEnabled())
const datePreview = computed(() => formatDate(Date.now()))

function selectDateFormat(event: SegmentCustomEvent) {
  const value = event.detail.value as DateFormatId
  dateFormat.value = value
  setDateFormat(value)
}

function handleToggleShowYear(checked: boolean) {
  showYear.value = checked
  setShowYearEnabled(checked)
}

function selectMake(value: string) {
  if (value !== make.value) model.value = ''
  make.value = value
  commitCarInfo()
}

function selectModel(value: string) {
  model.value = value
  commitCarInfo()
}

function commitCarInfo() {
  const y = Number(year.value)
  if (!make.value.trim() || !model.value.trim() || Number.isNaN(y)) return

  const capacityTrimmed = tankCapacity.value.trim().replace(',', '.')
  const capacityNumber = capacityTrimmed === '' ? undefined : Number(capacityTrimmed)
  if (capacityNumber !== undefined && (Number.isNaN(capacityNumber) || capacityNumber < 0)) return

  if (
    make.value.trim() === props.car.make &&
    model.value.trim() === props.car.model &&
    y === props.car.year &&
    capacityNumber === props.car.tankCapacity
  ) {
    return
  }
  emit('save', { make: make.value.trim(), model: model.value.trim(), year: y, tankCapacity: capacityNumber })
}

function handleDelete() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  emit('deleteCar')
}

const toast = useToast()
const checkingUpdate = ref(false)
const appVersion = __APP_VERSION__

async function handleCheckForUpdate() {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  haptic('tap')
  try {
    const result = await checkForUpdate()
    if (result === 'updated') {
      toast.show('Найдено обновление — приложение сейчас перезапустится')
    } else if (result === 'up-to-date') {
      toast.show('У вас последняя версия')
    } else if (result === 'offline') {
      toast.show('Нет соединения — попробуйте позже')
    } else {
      toast.show('Не удалось проверить обновления')
    }
  } finally {
    checkingUpdate.value = false
  }
}

const cloudSync = useCloudSync()

const cloudProviders: { id: CloudProvider; label: string }[] = [
  { id: 'google', label: 'Google Диск' },
  { id: 'yandex', label: 'Яндекс.Диск' },
]

const activeAccount = computed(() => {
  const provider = cloudSync.state.activeProvider
  return provider ? cloudSync.state.accounts[provider] : null
})

const accountInitial = computed(() => {
  const name = activeAccount.value?.name || activeAccount.value?.email || '?'
  return name.charAt(0).toUpperCase()
})

const activeLastSync = computed(() => {
  const provider = cloudSync.state.activeProvider
  return provider ? cloudSync.state.lastSync[provider] : null
})

function formatSyncDate(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function handleSelectProvider(event: SegmentCustomEvent) {
  const provider = event.detail.value as CloudProvider
  if (!cloudSync.isProviderConfigured(provider) || cloudSync.state.activeProvider === provider) return
  void cloudSync.connect(provider)
}

function handleSyncNow() {
  haptic('tap')
  void cloudSync.syncNow()
}

async function handleRestoreFromCloud() {
  const provider = cloudSync.state.activeProvider
  if (!provider) return
  const confirmed = window.confirm(
    'Восстановление заменит текущие данные на устройстве резервной копией из облака. Продолжить?',
  )
  if (!confirmed) return
  haptic('tap')
  const result = await cloudSync.restoreFromCloud(provider)
  toast.show(result.ok ? 'Данные восстановлены из облака' : result.error)
}

function handleDisconnectCloud() {
  const provider = cloudSync.state.activeProvider
  if (provider) cloudSync.disconnect(provider)
}

function triggerImport() {
  fileInput.value?.click()
}

function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('import', file)
  input.value = ''
}
</script>

<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>Настройки</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content :fullscreen="true">
    <ion-refresher slot="fixed" @ionRefresh="handlePullToRefresh">
      <ion-refresher-content></ion-refresher-content>
    </ion-refresher>

    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">Настройки</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-list inset>
      <ion-list-header>Автомобиль</ion-list-header>
      <ion-item button detail @click="activePicker = 'make'">
        <SettingsIconBadge slot="start" :icon="carSportOutline" color="primary" />
        <ion-label>Марка</ion-label>
        <ion-note slot="end">{{ make || 'Выбрать' }}</ion-note>
      </ion-item>
      <ion-item button detail :disabled="!make" @click="activePicker = 'model'">
        <SettingsIconBadge slot="start" :icon="carSportOutline" color="primary" />
        <ion-label>Модель</ion-label>
        <ion-note slot="end">{{ model || (make ? 'Выбрать' : 'Сначала выберите марку') }}</ion-note>
      </ion-item>
      <ion-item>
        <SettingsIconBadge slot="start" :icon="calendarOutline" color="tertiary" />
        <ion-input
          v-model="year"
          label="Год выпуска"
          label-placement="stacked"
          inputmode="numeric"
          @ion-blur="commitCarInfo"
        />
      </ion-item>
      <ion-item lines="none">
        <SettingsIconBadge slot="start" :icon="waterOutline" color="secondary" />
        <ion-input
          v-model="tankCapacity"
          label="Объём бака, л (необязательно)"
          label-placement="stacked"
          inputmode="decimal"
          placeholder="—"
          @ion-blur="commitCarInfo"
        />
      </ion-item>
    </ion-list>
    <p class="hint">
      Зная объём бака, можно точно считать расход и по неполным заправкам — если отмечать
      остаток в баке. Не знаете точное значение — посмотрите в ПТС, руководстве по
      эксплуатации или на крышке бензобака. Ориентировочно: седаны и хэтчбеки — 40–55 л,
      кроссоверы — 55–65 л, крупные внедорожники — 70–95 л.
    </p>

    <ion-list inset>
      <ion-item button detail @click="emit('openCarSwitcher')">
        <SettingsIconBadge slot="start" :icon="carOutline" color="success" />
        <ion-label>Мои машины ({{ carCount }})</ion-label>
      </ion-item>
      <ion-item button detail lines="none" @click="emit('sharePassport')">
        <SettingsIconBadge slot="start" :icon="documentTextOutline" color="primary" />
        <ion-label>Поделиться паспортом машины</ion-label>
      </ion-item>
    </ion-list>

    <ion-list v-if="notificationsSupported" inset>
      <ion-list-header>Уведомления</ion-list-header>
      <ion-item lines="none">
        <SettingsIconBadge slot="start" :icon="notificationsOutline" color="danger" />
        <ion-toggle
          justify="space-between"
          :checked="notificationsOn"
          @ion-change="(e: ToggleCustomEvent) => handleToggleNotifications(e.detail.checked)"
        >
          Уведомлять о ТО
        </ion-toggle>
      </ion-item>
    </ion-list>
    <p v-if="notificationsSupported" class="hint">
      Когда параметр становится «скоро» или «просрочено»
    </p>
    <p v-if="notificationsBlocked" class="hint error">
      Уведомления заблокированы в браузере — включите их в настройках сайта, чтобы приложение
      могло их показывать
    </p>

    <ion-list inset>
      <ion-list-header>Конфиденциальность</ion-list-header>
      <ion-item :lines="lockOn && biometricSupported ? 'full' : 'none'">
        <SettingsIconBadge slot="start" :icon="lockClosedOutline" color="medium" />
        <ion-toggle
          justify="space-between"
          :checked="lockOn"
          @ion-change="(e: ToggleCustomEvent) => handleTogglePasscode(e.detail.checked)"
        >
          Код-пароль
        </ion-toggle>
      </ion-item>
      <ion-item v-if="lockOn && biometricSupported" lines="none">
        <SettingsIconBadge slot="start" :icon="fingerPrintOutline" color="dark" />
        <ion-toggle
          justify="space-between"
          :checked="biometricOn"
          @ion-change="(e: ToggleCustomEvent) => handleToggleBiometric(e.detail.checked)"
        >
          Face ID / отпечаток
        </ion-toggle>
      </ion-item>
      <ion-item v-if="lockOn" button :detail="false" lines="none" @click="showAppLockSheet = true">
        <SettingsIconBadge slot="start" :icon="keyOutline" color="medium" />
        <ion-label color="primary">Изменить код-пароль</ion-label>
      </ion-item>
    </ion-list>
    <p class="hint">
      Код-пароль запрашивается при каждом открытии приложения. Это блокирует экран, а не
      шифрует данные — они по-прежнему хранятся на устройстве в открытом виде
    </p>

    <ion-list inset>
      <ion-list-header>Формат даты</ion-list-header>
      <ion-item>
        <ion-segment :value="dateFormat" @ionChange="selectDateFormat">
          <ion-segment-button v-for="opt in DATE_FORMAT_OPTIONS" :key="opt.value" :value="opt.value">
            <ion-label>{{ opt.label }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-item>
      <ion-item lines="none">
        <SettingsIconBadge slot="start" :icon="eyeOutline" color="secondary" />
        <ion-toggle justify="space-between" :checked="showYear" @ion-change="(e: ToggleCustomEvent) => handleToggleShowYear(e.detail.checked)">
          Показывать год
        </ion-toggle>
      </ion-item>
    </ion-list>
    <p class="hint">«Авто» использует формат вашего региона. Пример: {{ datePreview }}. Применяется к датам заправок</p>

    <ion-list inset>
      <ion-list-header>Обновления</ion-list-header>
      <ion-item button :detail="false" lines="none" :disabled="checkingUpdate" @click="handleCheckForUpdate">
        <SettingsIconBadge slot="start" :icon="refreshOutline" color="primary" />
        <ion-label color="primary">{{ checkingUpdate ? 'Проверяем…' : 'Проверить обновления' }}</ion-label>
      </ion-item>
    </ion-list>
    <p class="hint">
      Приложение само проверяет обновления в фоне. Нажмите, чтобы проверить прямо сейчас — если
      вышла новая версия, скрипты скачаются заново и приложение перезапустится
    </p>
    <p class="hint">Версия {{ appVersion }}</p>

    <ion-list inset>
      <ion-list-header>Резервная копия</ion-list-header>
      <ion-item button :detail="false" @click="emit('export')">
        <SettingsIconBadge slot="start" :icon="downloadOutline" color="success" />
        <ion-label color="primary">Экспортировать данные</ion-label>
      </ion-item>
      <ion-item button :detail="false" lines="none" @click="triggerImport">
        <SettingsIconBadge slot="start" :icon="cloudUploadOutline" color="tertiary" />
        <ion-label color="primary">Импортировать резервную копию</ion-label>
      </ion-item>
      <input
        ref="fileInput"
        type="file"
        accept="application/json"
        class="sr-only"
        @change="handleFileSelected"
      />
    </ion-list>
    <p v-if="importError" class="hint error">{{ importError }}</p>
    <p v-else class="hint">
      Экспорт сохраняет все машины, параметры ТО, заправки и историю в файл. Импорт полностью
      заменит текущие данные содержимым файла
    </p>

    <ion-list inset>
      <ion-list-header>Облако</ion-list-header>
      <ion-item lines="none">
        <ion-segment :value="cloudSync.state.activeProvider ?? undefined" @ionChange="handleSelectProvider">
          <ion-segment-button
            v-for="p in cloudProviders"
            :key="p.id"
            :value="p.id"
            :disabled="!cloudSync.isProviderConfigured(p.id)"
          >
            <ion-label>{{ p.label }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-item>
    </ion-list>

    <template v-if="activeAccount">
      <ion-list inset>
        <ion-item lines="full">
          <ion-avatar slot="start" class="cloud-avatar">{{ accountInitial }}</ion-avatar>
          <ion-label>
            <h2>{{ activeAccount.name }}</h2>
            <p v-if="activeAccount.email">{{ activeAccount.email }}</p>
          </ion-label>
        </ion-item>
        <ion-item lines="none">
          <SettingsIconBadge slot="start" :icon="syncOutline" color="success" />
          <ion-toggle justify="space-between" :checked="cloudSync.state.autoSync" @ion-change="(e: ToggleCustomEvent) => cloudSync.setAutoSync(e.detail.checked)">
            Автосинхронизация
          </ion-toggle>
        </ion-item>
      </ion-list>
      <ion-list inset>
        <ion-item button :detail="false" :disabled="cloudSync.state.syncing" @click="handleSyncNow">
          <SettingsIconBadge slot="start" :icon="refreshOutline" color="primary" />
          <ion-label color="primary">{{ cloudSync.state.syncing ? 'Синхронизация…' : 'Синхронизировать сейчас' }}</ion-label>
        </ion-item>
        <ion-item button :detail="false" :disabled="cloudSync.state.syncing" @click="handleRestoreFromCloud">
          <SettingsIconBadge slot="start" :icon="cloudDownloadOutline" color="tertiary" />
          <ion-label color="primary">Восстановить из облака</ion-label>
        </ion-item>
        <ion-item button :detail="false" lines="none" @click="handleDisconnectCloud">
          <SettingsIconBadge slot="start" :icon="closeCircleOutline" color="danger" />
          <ion-label color="danger">Отключить облако</ion-label>
        </ion-item>
      </ion-list>
      <p v-if="cloudSync.state.error" class="hint error">{{ cloudSync.state.error }}</p>
      <p v-else-if="activeLastSync" class="hint">
        Последняя синхронизация: {{ formatSyncDate(activeLastSync.savedAt) }} · версия {{ activeLastSync.appVersion }}
      </p>
      <p v-else class="hint">Ещё не синхронизировалось</p>
    </template>
    <p v-else class="hint">
      Выберите облако и войдите в свой аккаунт, чтобы хранить резервную копию онлайн и синхронизировать её
      между устройствами
    </p>

    <ion-list inset>
      <ion-list-header>Опасная зона</ion-list-header>
      <ion-item button :detail="false" lines="none" @click="handleDelete">
        <SettingsIconBadge slot="start" :icon="trashOutline" color="danger" />
        <ion-label color="danger">{{ confirmingDelete ? 'Точно удалить эту машину?' : 'Удалить эту машину' }}</ion-label>
      </ion-item>
    </ion-list>

    <AppLockSheet
      v-if="showAppLockSheet"
      @close="showAppLockSheet = false"
      @saved="handleAppLockSaved"
    />
    <p class="hint">
      Удалит эту машину, её параметры ТО, заправки и историю без возможности восстановления.
      Другие ваши машины не затронет
    </p>

    <PickerSheet
      v-if="activePicker === 'make'"
      title="Марка"
      :items="CAR_MAKES"
      :selected="make"
      placeholder="Поиск марки"
      custom-label="Своя марка"
      @close="activePicker = null"
      @select="selectMake"
    />
    <PickerSheet
      v-if="activePicker === 'model'"
      title="Модель"
      :items="modelOptions"
      :selected="model"
      placeholder="Поиск модели"
      custom-label="Своя модель"
      @close="activePicker = null"
      @select="selectModel"
    />
  </ion-content>
</template>

<style scoped>
.hint {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 4px 32px 16px;
  line-height: 1.4;
}

.hint.error {
  color: var(--ion-color-danger);
}

.cloud-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
}
</style>
