<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonModal,
  IonNote,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { parseReminderInput } from '../utils/reminderParser'

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

function handleSave() {
  const p = parsed.value
  if (!p) return
  emit('save', {
    text: p.text,
    dueMileage: p.relativeKm !== undefined ? props.currentMileage + p.relativeKm : undefined,
    dueDate: p.dueDate,
    hasTime: p.hasTime,
  })
}
</script>

<template>
  <ion-modal :is-open="true" :breakpoints="[0, 1]" :initial-breakpoint="1" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>Напоминание</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
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
