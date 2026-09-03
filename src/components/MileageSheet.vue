<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import type { Car, FuelEntry, HistoryEntry } from '../types'
import { mileageInputSeed, mileageAnchors, plausibleMileageRange } from '../utils/mileage'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  car: Car
  fuelEntries: FuelEntry[]
  historyEntries: HistoryEntry[]
}>()

const emit = defineEmits<{
  close: []
  save: [mileage: number, date: number, isRollback: boolean]
}>()

const value = ref(mileageInputSeed(props.car.currentMileage))
// The seeded value is deliberately below currentMileage (only the trailing
// digits are missing) — don't flag it as "too low" until the user actually
// types something.
const touched = ref(false)
const dateIso = ref(new Date().toISOString())
const nowMs = Date.now()
const minDateIso = new Date(props.car.createdAt).toISOString()
const maxDateIso = new Date(nowMs).toISOString()

const number = computed(() => Number(value.value.replace(/\s/g, '')))
const hasNumber = computed(() => value.value.trim().length > 0 && !Number.isNaN(number.value))
const isNegative = computed(() => hasNumber.value && number.value < 0)

const dateMs = computed(() => new Date(dateIso.value).getTime())
const dateInFuture = computed(() => dateMs.value > Date.now())
const dateTooEarly = computed(() => dateMs.value < props.car.createdAt)
const dateInvalid = computed(() => dateInFuture.value || dateTooEarly.value)

const range = computed(() => {
  const anchors = mileageAnchors(props.car, props.fuelEntries, props.historyEntries, dateMs.value)
  return plausibleMileageRange(anchors, dateMs.value)
})

const isBelowMinReal = computed(
  () => hasNumber.value && !isNegative.value && !dateInvalid.value && number.value < range.value.min,
)
const isAboveMaxReal = computed(
  () =>
    hasNumber.value && !isNegative.value && !dateInvalid.value && range.value.max !== null && number.value > range.value.max,
)

// Displayed/gated on `touched`: the pre-filled seed value is deliberately
// below the real current mileage (see above), so the sheet must not
// immediately present itself as a rollback the moment it opens — only once
// the user has actually typed something.
const isBelowMin = computed(() => touched.value && isBelowMinReal.value)
const isAboveMax = computed(() => touched.value && isAboveMaxReal.value)

// Backdating below the last known reading is a plausible correction (that's
// the whole point of picking an earlier date) and needs no confirmation —
// but contradicting a fixed fuel/service record is a genuine rollback, and
// exceeding a later fixed record is a hard contradiction this dialog can't
// resolve (it would mean *that* record's mileage is wrong, not this one).
const canSaveNormally = computed(
  () => hasNumber.value && !isNegative.value && !dateInvalid.value && !isAboveMaxReal.value && !isBelowMinReal.value,
)
const canRollback = computed(
  () => hasNumber.value && !isNegative.value && !dateInvalid.value && !isAboveMaxReal.value && isBelowMinReal.value,
)

function fmtKm(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const hint = computed(() => {
  if (dateInFuture.value) return 'Дата не может быть в будущем'
  if (dateTooEarly.value) return `Дата не может быть раньше добавления автомобиля (${fmtDate(props.car.createdAt)})`
  if (!touched.value) return null
  if (isNegative.value) return 'Пробег не может быть отрицательным'
  if (isAboveMax.value) {
    return `На ${fmtDate(range.value.maxAt as number)} уже зафиксирован пробег ${fmtKm(range.value.max as number)} км — на более раннюю дату пробег не может быть больше`
  }
  if (isBelowMin.value) {
    const at = range.value.minAt !== null ? fmtDate(range.value.minAt) : null
    return at
      ? `На ${at} уже был зафиксирован пробег ${fmtKm(range.value.min)} км. Если одометр был действительно скручен, нажмите «Скрутка пробега»`
      : 'Если одометр был действительно скручен, нажмите «Скрутка пробега»'
  }
  return null
})

function handleSave(rollback: boolean) {
  if (rollback ? !canRollback.value : !canSaveNormally.value) return
  if (rollback) haptic('warning')
  emit('save', Math.round(number.value), dateMs.value, rollback)
}
</script>

<template>
  <ion-modal :is-open="true" :breakpoints="[0, 1]" :initial-breakpoint="1" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>Пробег</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="isBelowMin" color="danger" :strong="true" :disabled="!canRollback" @click="handleSave(true)">
            Скрутка пробега
          </ion-button>
          <ion-button v-else :strong="true" :disabled="!canSaveNormally" @click="handleSave(false)">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="full">
          <ion-input
            v-model="value"
            label="Пробег на выбранную дату, км"
            label-placement="stacked"
            type="text"
            inputmode="numeric"
            autofocus
            @ion-input="touched = true"
          />
        </ion-item>
        <ion-item lines="none">
          <ion-label>Дата и время</ion-label>
          <ion-datetime-button slot="end" datetime="mileage-entry-date" />
        </ion-item>
      </ion-list>
      <ion-modal :keep-contents-mounted="true">
        <ion-datetime
          id="mileage-entry-date"
          v-model="dateIso"
          presentation="date-time"
          locale="ru-RU"
          :min="minDateIso"
          :max="maxDateIso"
        />
      </ion-modal>
      <ion-note v-if="hint" :color="isBelowMin ? 'danger' : 'medium'" class="hint">
        {{ hint }}
      </ion-note>
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
