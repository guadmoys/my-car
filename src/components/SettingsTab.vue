<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  } else {
    setNotificationsEnabled(false)
    notificationsOn.value = false
    notificationsBlocked.value = permission === 'denied'
  }
}

const dateFormat = ref<DateFormatId>(getDateFormat())
const showYear = ref(isShowYearEnabled())
const datePreview = computed(() => formatDate(Date.now()))

function selectDateFormat(value: DateFormatId) {
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
  <div class="tab-page">
    <header class="topbar">
      <h1>Настройки</h1>
    </header>

    <div class="form">
      <div class="car-zone">
        <div class="section-title">Автомобиль</div>
        <div class="group">
          <button class="field picker-field" @click="activePicker = 'make'">
            <label>Марка</label>
            <span class="picker-value" :class="{ placeholder: !make }">{{ make || 'Выбрать' }}</span>
          </button>
          <div class="divider" />
          <button
            class="field picker-field"
            :class="{ disabled: !make }"
            @click="make && (activePicker = 'model')"
          >
            <label>Модель</label>
            <span class="picker-value" :class="{ placeholder: !model }">
              {{ model || (make ? 'Выбрать' : 'Сначала выберите марку') }}
            </span>
          </button>
          <div class="divider" />
          <div class="field">
            <label>Год выпуска</label>
            <input v-model="year" type="text" inputmode="numeric" @blur="commitCarInfo" />
          </div>
          <div class="divider" />
          <div class="field">
            <label>Объём бака, л (необязательно)</label>
            <input
              v-model="tankCapacity"
              type="text"
              inputmode="decimal"
              placeholder="—"
              @blur="commitCarInfo"
            />
          </div>
        </div>
        <p class="hint">
          Зная объём бака, можно точно считать расход и по неполным заправкам — если отмечать
          остаток в баке. Не знаете точное значение — посмотрите в ПТС, руководстве по
          эксплуатации или на крышке бензобака. Ориентировочно: седаны и хэтчбеки — 40–55 л,
          кроссоверы — 55–65 л, крупные внедорожники — 70–95 л.
        </p>
        <button class="backup-btn" @click="emit('openCarSwitcher')">
          Мои машины ({{ carCount }})
        </button>
        <button class="backup-btn" @click="emit('sharePassport')">
          Поделиться паспортом машины
        </button>
      </div>

      <div v-if="notificationsSupported" class="notifications-zone">
        <div class="section-title">Уведомления</div>
        <div class="group">
          <label class="field notif-row">
            <span>
              <span class="notif-label">Уведомлять о ТО</span>
              <span class="hint notif-hint">Когда параметр становится «скоро» или «просрочено»</span>
            </span>
            <label class="switch">
              <input
                type="checkbox"
                :checked="notificationsOn"
                @change="handleToggleNotifications(($event.target as HTMLInputElement).checked)"
              />
              <span class="slider" />
            </label>
          </label>
        </div>
        <p v-if="notificationsBlocked" class="hint error">
          Уведомления заблокированы в браузере — включите их в настройках сайта, чтобы приложение
          могло их показывать
        </p>
      </div>

      <div class="date-format-zone">
        <div class="section-title">Формат даты</div>
        <div class="group">
          <div class="format-chips">
            <button
              v-for="opt in DATE_FORMAT_OPTIONS"
              :key="opt.value"
              class="format-chip"
              :class="{ active: dateFormat === opt.value }"
              @click="selectDateFormat(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
          <div class="divider" />
          <label class="field notif-row">
            <span class="notif-label">Показывать год</span>
            <label class="switch">
              <input
                type="checkbox"
                :checked="showYear"
                @change="handleToggleShowYear(($event.target as HTMLInputElement).checked)"
              />
              <span class="slider" />
            </label>
          </label>
        </div>
        <p class="hint">
          «Авто» использует формат вашего региона. Пример: {{ datePreview }}. Применяется к датам
          заправок
        </p>
      </div>

      <div class="update-zone">
        <div class="section-title">Обновления</div>
        <button class="backup-btn" :disabled="checkingUpdate" @click="handleCheckForUpdate">
          {{ checkingUpdate ? 'Проверяем…' : 'Проверить обновления' }}
        </button>
        <p class="hint">
          Приложение само проверяет обновления в фоне. Нажмите, чтобы проверить прямо сейчас — если
          вышла новая версия, скрипты скачаются заново и приложение перезапустится
        </p>
        <p class="hint version-hint">Версия {{ appVersion }}</p>
      </div>

      <div class="backup-zone">
        <div class="section-title">Резервная копия</div>
        <button class="backup-btn" @click="emit('export')">Экспортировать данные</button>
        <button class="backup-btn" @click="triggerImport">Импортировать резервную копию</button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json"
          class="sr-only"
          @change="handleFileSelected"
        />
        <p v-if="importError" class="hint error">{{ importError }}</p>
        <p v-else class="hint">
          Экспорт сохраняет все машины, параметры ТО, заправки и историю в файл. Импорт полностью
          заменит текущие данные содержимым файла
        </p>
      </div>

      <div class="danger-zone">
        <div class="section-title">Опасная зона</div>
        <button class="reset" @click="handleDelete">
          {{ confirmingDelete ? 'Точно удалить эту машину?' : 'Удалить эту машину' }}
        </button>
        <p class="hint">
          Удалит эту машину, её параметры ТО, заправки и историю без возможности восстановления.
          Другие ваши машины не затронет
        </p>
      </div>
    </div>

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
  </div>
</template>

<style scoped>
.tab-page {
  max-width: 560px;
  margin: 0 auto;
  padding: calc(16px + var(--safe-top)) 16px calc(96px + var(--safe-bottom));
}

.topbar {
  padding: 8px 4px 20px;
}

.topbar h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0 4px 8px;
}

.group {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 0 14px;
  border: 1px solid var(--card-border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 0;
}

.field label {
  font-size: 12px;
  color: var(--text-secondary);
}

.field input {
  border: none;
  background: transparent;
  font-size: 17px;
  color: var(--text);
  outline: none;
}

.picker-field {
  width: 100%;
  text-align: left;
  align-items: flex-start;
}

.picker-field.disabled {
  opacity: 0.5;
}

.picker-value {
  font-size: 17px;
  color: var(--text);
}

.picker-value.placeholder {
  color: var(--text-tertiary);
}

.divider {
  height: 1px;
  background: var(--separator);
}

.car-zone,
.notifications-zone,
.date-format-zone,
.update-zone,
.backup-zone,
.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.format-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0;
}

.format-chip {
  padding: 7px 14px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.format-chip.active {
  background: var(--blue);
  color: #fff;
}

.format-chip:active {
  opacity: 0.7;
}

.notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  cursor: pointer;
}

.notif-label {
  display: block;
  font-size: 16px;
  color: var(--text);
}

.notif-hint {
  display: block;
  margin: 2px 0 0;
  padding: 0;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  background: var(--fill-secondary);
  border-radius: 13px;
  transition: background 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.switch input:checked + .slider {
  background: var(--green);
}

.switch input:checked + .slider::before {
  transform: translateX(18px);
}

.backup-btn {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-pill);
  padding: 13px;
  color: var(--blue);
  font-size: 17px;
  font-weight: 500;
  text-align: center;
}

.backup-btn:active {
  opacity: 0.6;
}

.backup-btn:disabled {
  opacity: 0.5;
}

.hint.error {
  color: var(--red);
}

.version-hint {
  color: var(--text-tertiary);
}

.reset {
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-pill);
  padding: 13px;
  color: var(--red);
  font-size: 17px;
  font-weight: 500;
  text-align: center;
}

.reset:active {
  opacity: 0.6;
}

.hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 4px;
  line-height: 1.4;
}
</style>
