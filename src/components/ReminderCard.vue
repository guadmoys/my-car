<script setup lang="ts">
import { computed } from 'vue'
import { IonButton, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel } from '@ionic/vue'
import { alarmOutline, trash } from 'ionicons/icons'
import type { ReminderStatus } from '../types'

const props = defineProps<{
  status: ReminderStatus
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

const subtitle = computed(() => {
  const { reminder, isDue, remainingKm, remainingDays } = props.status

  if (remainingKm !== undefined) {
    return isDue ? `Пробег достигнут: ${fmt(reminder.dueMileage as number)} км` : `Через ${fmt(remainingKm)} км`
  }

  const date = new Date(reminder.dueDate as number)
  const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = reminder.hasTime ? ` в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''
  if (isDue) return `Просрочено · ${dateStr}${timeStr}`
  return `${dateStr}${timeStr} · через ${remainingDays} дн.`
})
</script>

<template>
  <ion-item-sliding>
    <ion-item lines="full">
      <ion-icon slot="start" :icon="alarmOutline" :color="status.isDue ? 'due' : 'medium'" />
      <ion-label class="ion-text-wrap">
        <h2>{{ status.reminder.text }}</h2>
        <p :class="{ due: status.isDue }">{{ subtitle }}</p>
      </ion-label>
      <ion-button slot="end" size="small" fill="outline" @click.stop="emit('delete', status.reminder.id)">
        Готово
      </ion-button>
    </ion-item>

    <ion-item-options side="end">
      <ion-item-option color="danger" @click="emit('delete', status.reminder.id)">
        <ion-icon slot="icon-only" :icon="trash" />
      </ion-item-option>
    </ion-item-options>
  </ion-item-sliding>
</template>

<style scoped>
p.due {
  color: var(--ion-color-due);
}
</style>
