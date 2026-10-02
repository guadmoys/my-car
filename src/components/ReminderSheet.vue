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
  IonSegment,
  IonSegmentButton,
  IonTextarea,
  IonTitle,
  IonToolbar,
  type SegmentCustomEvent,
} from '@ionic/vue'
import { parseReminderInput } from '../utils/reminderParser'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  currentMileage: number
}>()

const emit = defineEmits<{
  close: []
  save: [payload: { text: string; dueMileage?: number; dueDate?: number; hasTime?: boolean }]
}>()

const value = ref('')

const parsed = computed(() => parseReminderInput(value.value))
const isValid = computed(() => value.value.trim() !== '' && parsed.value !== null)

const preview = computed(() => {
  const p = parsed.value
  if (!p) return null
  if (p.relativeKm !== undefined) {
    const target = props.currentMileage + p.relativeKm
    return `Напомним на пробеге ${target.toLocaleString('ru-RU')} км (через ${p.relativeKm.toLocaleString('ru-RU')} км)`
  }
  const date = new Date(p.dueDate as number)
  const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  if (p.hasTime) {
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return `Напомним ${dateStr} в ${timeStr}`
  }
  return `Напомним ${dateStr}`
})

// Fallback for anyone who doesn't want to fight the shorthand: a plain
// picker (пробег/дата + a text field) that produces the exact same payload
// without needing the text to parse. Off by default so the fast single-field
// path stays the default for people who already know the shorthand.
const showManualPicker = ref(false)
const manualMode = ref<'km' | 'date'>('km')
const manualKm = ref('')
const manualDateIso = ref(new Date().toISOString())
const manualText = ref('')

const manualKmNumber = computed(() => Number(manualKm.value.replace(/\s/g, '').replace(',', '.')))
const manualValid = computed(() => {
  if (manualText.value.trim() === '') return false
  if (manualMode.value === 'km') return manualKm.value.trim() !== '' && !Number.isNaN(manualKmNumber.value) && manualKmNumber.value > 0
  return true
})

const manualPreview = computed(() => {
  if (manualMode.value === 'km') {
    if (manualKm.value.trim() === '' || Number.isNaN(manualKmNumber.value) || manualKmNumber.value <= 0) return null
    const target = props.currentMileage + manualKmNumber.value
    return `Напомним на пробеге ${target.toLocaleString('ru-RU')} км (через ${manualKmNumber.value.toLocaleString('ru-RU')} км)`
  }
  const dateStr = new Date(manualDateIso.value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  return `Напомним ${dateStr}`
})

function openManualPicker() {
  haptic('tap')
  // Carry over whatever was already typed so switching modes doesn't lose it.
  manualText.value = value.value.trim()
  showManualPicker.value = true
}

function closeManualPicker() {
  haptic('tap')
  showManualPicker.value = false
}

function selectManualMode(e: SegmentCustomEvent) {
  haptic('tap')
  manualMode.value = e.detail.value as 'km' | 'date'
}

function handleSave() {
  if (showManualPicker.value) {
    if (!manualValid.value) return
    emit('save', {
      text: manualText.value.trim(),
      dueMileage: manualMode.value === 'km' ? props.currentMileage + Math.round(manualKmNumber.value) : undefined,
      dueDate: manualMode.value === 'date' ? new Date(manualDateIso.value).getTime() : undefined,
      hasTime: false,
    })
    return
  }
  const p = parsed.value
  if (!p) return
  emit('save', {
    text: p.text,
    dueMileage: p.relativeKm !== undefined ? props.currentMileage + p.relativeKm : undefined,
    dueDate: p.dueDate,
    hasTime: p.hasTime,
  })
}

const canSave = computed(() => (showManualPicker.value ? manualValid.value : isValid.value))

// Guards only the accidental paths (swipe-down, backdrop tap) — the explicit
// Отмена button still closes immediately, same as every other sheet.
async function canDismiss(): Promise<boolean> {
  const hasData = showManualPicker.value
    ? manualText.value.trim() !== '' || manualKm.value.trim() !== ''
    : value.value.trim() !== ''
  if (!hasData) return true
  return window.confirm('Напоминание не будет сохранено. Закрыть?')
}
</script>

<template>
  <ion-modal
    :is-open="true"
    :breakpoints="[0, 1]"
    :initial-breakpoint="1"
    :can-dismiss="canDismiss"
    @did-dismiss="emit('close')"
  >
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>Напоминание</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!canSave" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <template v-if="!showManualPicker">
        <ion-list inset>
          <ion-item lines="none">
            <ion-textarea
              v-model="value"
              label="Напоминание"
              label-placement="stacked"
              placeholder="через 300 км проверить масло"
              :auto-grow="true"
              :rows="2"
              autofocus
            />
          </ion-item>
        </ion-list>
        <ion-note v-if="preview" color="primary" class="hint">{{ preview }}</ion-note>
        <ion-note v-else-if="value.trim() !== ''" color="danger" class="hint">
          Не удалось распознать — укажите «через N км» или дату в формате ДД.ММ.ГГГГ
        </ion-note>
        <ion-note v-else color="medium" class="hint">
          Например: «через 300км проверить масло», «22.01.2026 проверить масло» или
          «22.01.2026 12:30 запись в сервис»
        </ion-note>
        <ion-button fill="clear" size="small" class="manual-toggle" @click="openManualPicker">
          Указать пробег или дату вручную
        </ion-button>
      </template>

      <template v-else>
        <ion-list inset>
          <ion-item lines="full">
            <ion-segment :value="manualMode" @ionChange="selectManualMode">
              <ion-segment-button value="km"><ion-label>По пробегу</ion-label></ion-segment-button>
              <ion-segment-button value="date"><ion-label>По дате</ion-label></ion-segment-button>
            </ion-segment>
          </ion-item>
          <ion-item v-if="manualMode === 'km'" lines="none">
            <ion-input
              v-model="manualKm"
              label="Через сколько км напомнить"
              label-placement="stacked"
              enterkeyhint="next" inputmode="numeric"
              placeholder="300"
              autofocus
            />
          </ion-item>
          <ion-item v-else lines="none">
            <ion-label>Дата</ion-label>
            <ion-datetime-button slot="end" datetime="reminder-manual-date" />
          </ion-item>
        </ion-list>
        <ion-modal v-if="manualMode === 'date'" :keep-contents-mounted="true">
          <ion-datetime id="reminder-manual-date" v-model="manualDateIso" presentation="date" locale="ru-RU" />
        </ion-modal>

        <ion-list inset>
          <ion-item lines="none">
            <ion-input v-model="manualText" label="О чём напомнить" label-placement="stacked" placeholder="Проверить масло" />
          </ion-item>
        </ion-list>
        <ion-note v-if="manualPreview" color="primary" class="hint">{{ manualPreview }}</ion-note>

        <ion-button fill="clear" size="small" class="manual-toggle" @click="closeManualPicker">
          Ввести текстом
        </ion-button>
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

.manual-toggle {
  display: block;
  margin: 4px auto 0;
}
</style>
