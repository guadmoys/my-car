<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
  type SegmentCustomEvent,
  type ToggleCustomEvent,
} from '@ionic/vue'
import type { Car } from '../types'
import { CAR_MAKES, modelsForMake } from '../data/carCatalog'
import PickerSheet from './PickerSheet.vue'
import {
  getNotificationPermission,
  isNotificationApiSupported,
  isNotificationsEnabled,
  requestNotificationPermission,
  setNotificationsEnabled,
} from '../utils/notifications'
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
    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">Настройки</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-list inset>
      <ion-list-header>Автомобиль</ion-list-header>
      <ion-item button detail @click="activePicker = 'make'">
        <ion-label>Марка</ion-label>
        <ion-note slot="end">{{ make || 'Выбрать' }}</ion-note>
      </ion-item>
      <ion-item button detail :disabled="!make" @click="activePicker = 'model'">
        <ion-label>Модель</ion-label>
        <ion-note slot="end">{{ model || (make ? 'Выбрать' : 'Сначала выберите марку') }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-input
          v-model="year"
          label="Год выпуска"
          label-placement="stacked"
          inputmode="numeric"
          @ion-blur="commitCarInfo"
        />
      </ion-item>
      <ion-item lines="none">
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
        <ion-label>Мои машины ({{ carCount }})</ion-label>
      </ion-item>
      <ion-item button detail lines="none" @click="emit('sharePassport')">
        <ion-label>Поделиться паспортом машины</ion-label>
      </ion-item>
    </ion-list>

    <ion-list v-if="notificationsSupported" inset>
      <ion-list-header>Уведомления</ion-list-header>
      <ion-item lines="none">
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
      <ion-list-header>Формат даты</ion-list-header>
      <ion-item>
        <ion-segment :value="dateFormat" @ionChange="selectDateFormat">
          <ion-segment-button v-for="opt in DATE_FORMAT_OPTIONS" :key="opt.value" :value="opt.value">
            <ion-label>{{ opt.label }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-item>
      <ion-item lines="none">
        <ion-toggle justify="space-between" :checked="showYear" @ion-change="(e: ToggleCustomEvent) => handleToggleShowYear(e.detail.checked)">
          Показывать год
        </ion-toggle>
      </ion-item>
    </ion-list>
    <p class="hint">«Авто» использует формат вашего региона. Пример: {{ datePreview }}. Применяется к датам заправок</p>

    <ion-list inset>
      <ion-list-header>Обновления</ion-list-header>
      <ion-item button :detail="false" lines="none" :disabled="checkingUpdate" @click="handleCheckForUpdate">
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
        <ion-label color="primary">Экспортировать данные</ion-label>
      </ion-item>
      <ion-item button :detail="false" lines="none" @click="triggerImport">
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
          <ion-toggle justify="space-between" :checked="cloudSync.state.autoSync" @ion-change="(e: ToggleCustomEvent) => cloudSync.setAutoSync(e.detail.checked)">
            Автосинхронизация
          </ion-toggle>
        </ion-item>
      </ion-list>
      <ion-list inset>
        <ion-item button :detail="false" :disabled="cloudSync.state.syncing" @click="handleSyncNow">
          <ion-label color="primary">{{ cloudSync.state.syncing ? 'Синхронизация…' : 'Синхронизировать сейчас' }}</ion-label>
        </ion-item>
        <ion-item button :detail="false" :disabled="cloudSync.state.syncing" @click="handleRestoreFromCloud">
          <ion-label color="primary">Восстановить из облака</ion-label>
        </ion-item>
        <ion-item button :detail="false" lines="none" @click="handleDisconnectCloud">
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
        <ion-label color="danger">{{ confirmingDelete ? 'Точно удалить эту машину?' : 'Удалить эту машину' }}</ion-label>
      </ion-item>
    </ion-list>
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
