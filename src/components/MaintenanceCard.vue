<script setup lang="ts">
import { computed } from 'vue'
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonChip,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
  IonProgressBar,
  IonToggle,
} from '@ionic/vue'
import { calendarOutline, cartOutline, checkmark, ellipse, trash } from 'ionicons/icons'
import type { MaintenanceStatus } from '../types'
import { PART_LINK_SITES, partSearchQuery } from '../utils/partLinks'

const props = defineProps<{
  status: MaintenanceStatus
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  markServiced: [id: string]
  toggle: [id: string, enabled: boolean]
  edit: [id: string]
  delete: [id: string]
  select: [id: string]
}>()

const stateColor = computed(() => props.status.state)

const rangeLabel = computed(() => {
  const { item } = props.status
  if (item.intervalKmMax) {
    return `${fmt(item.intervalKm)}–${fmt(item.intervalKmMax)} км`
  }
  return `${fmt(item.intervalKm)} км`
})

const statusLabel = computed(() => {
  const km = Math.abs(Math.round(props.status.remainingKm))
  if (props.status.remainingKm <= 0) {
    return km === 0 ? 'Пора провести ТО' : `Просрочено на ${fmt(km)} км`
  }
  return `Осталось ${fmt(km)} км`
})

const showBuyHint = computed(
  () => props.status.item.parts.length > 0 && props.status.state !== 'ok',
)

const DAY_MS = 24 * 60 * 60 * 1000

const dateLabel = computed(() => {
  const { item, remainingDays, estimatedDueDate } = props.status
  if (item.intervalMonths && remainingDays !== undefined) {
    const days = Math.abs(remainingDays)
    const prefix = remainingDays <= 0 ? `Просрочено на ${days} дн.` : `Осталось ${days} дн.`
    return `${prefix} · раз в ${item.intervalMonths} мес.`
  }
  if (estimatedDueDate !== undefined) {
    const daysUntil = Math.round((estimatedDueDate - Date.now()) / DAY_MS)
    if (daysUntil <= 0) return null
    return `≈ через ${daysUntil} дн. при вашем темпе езды`
  }
  return null
})

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <ion-item v-if="selectable" button :detail="false" @click="emit('select', status.item.id)">
    <ion-checkbox slot="start" :checked="selected" @ion-change="emit('select', status.item.id)" />
    <ion-icon slot="start" :icon="ellipse" :color="stateColor" />
    <ion-label>
      <h2>{{ status.item.name }}</h2>
      <p>{{ statusLabel }} · каждые {{ rangeLabel }}</p>
    </ion-label>
  </ion-item>

  <template v-else>
    <ion-item-sliding>
      <ion-item-options side="start">
        <ion-item-option color="success" @click="emit('markServiced', status.item.id)">
          <ion-icon slot="icon-only" :icon="checkmark" />
        </ion-item-option>
      </ion-item-options>

      <ion-item button :detail="false" :class="{ dimmed: !status.item.enabled }" @click="emit('edit', status.item.id)">
        <ion-icon slot="start" :icon="ellipse" :color="stateColor" />
        <ion-label class="ion-text-wrap">
          <h2>{{ status.item.name }}</h2>
          <p>{{ statusLabel }} · каждые {{ rangeLabel }}</p>
          <p v-if="dateLabel">
            <ion-icon :icon="calendarOutline" size="small" />
            {{ dateLabel }}
          </p>
          <ion-progress-bar :value="status.progress" :color="stateColor" />
        </ion-label>
        <ion-buttons slot="end">
          <ion-button size="small" fill="clear" @click.stop="emit('markServiced', status.item.id)">
            Готово
          </ion-button>
        </ion-buttons>
        <ion-toggle
          slot="end"
          :checked="status.item.enabled"
          :aria-label="`Учитывать «${status.item.name}»`"
          @click.stop
          @ion-change="(e) => emit('toggle', status.item.id, e.detail.checked)"
        />
      </ion-item>

      <ion-item-options side="end">
        <ion-item-option color="danger" @click="emit('delete', status.item.id)">
          <ion-icon slot="icon-only" :icon="trash" />
        </ion-item-option>
      </ion-item-options>
    </ion-item-sliding>

    <ion-item v-if="showBuyHint" lines="none" class="buy-hint">
      <ion-label class="ion-text-wrap">
        <p>
          <ion-icon :icon="cartOutline" size="small" />
          Пора купить {{ status.item.parts.length > 1 ? 'детали' : 'деталь' }}
        </p>
        <div v-for="part in status.item.parts" :key="part.id" class="part-row">
          <div class="part-row-top">
            <div class="part-info">
              <div class="part-name">{{ part.name }}</div>
              <ion-note>{{ [part.articleNumber, part.platform].filter(Boolean).join(' · ') || '—' }}</ion-note>
            </div>
            <ion-button v-if="part.url" :href="part.url" target="_blank" rel="noopener noreferrer" size="small" fill="outline">
              Купить
            </ion-button>
          </div>
          <div v-if="partSearchQuery(part)" class="quick-links">
            <ion-chip
              v-for="site in PART_LINK_SITES"
              :key="site.key"
              :href="site.url(partSearchQuery(part)!)"
              target="_blank"
              rel="noopener noreferrer"
              outline
            >
              {{ site.label }}
            </ion-chip>
          </div>
        </div>
      </ion-label>
    </ion-item>
  </template>
</template>

<style scoped>
.dimmed {
  opacity: 0.5;
}

ion-progress-bar {
  margin-top: 6px;
}

.part-row {
  margin-top: 8px;
}

.part-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.part-name {
  font-size: 14px;
  font-weight: 500;
}

.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
</style>
