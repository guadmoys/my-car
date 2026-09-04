<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { batteryHalfOutline, discOutline, syncOutline } from 'ionicons/icons'
import { COMPONENT_TYPE_LABELS, type ComponentCheck, type ComponentType } from '../types'

const props = defineProps<{
  latestByType: Record<ComponentType, ComponentCheck | null>
}>()

const emit = defineEmits<{
  close: []
  update: [type: ComponentType]
}>()

const ICONS: Record<ComponentType, string> = {
  tires: syncOutline,
  battery: batteryHalfOutline,
  brakePads: discOutline,
}

const SEASON_LABELS: Record<string, string> = {
  summer: 'Летние',
  winter: 'Зимние',
  allseason: 'Всесезонные',
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtKm(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function summary(type: ComponentType): string {
  const c = props.latestByType[type]
  if (!c) return 'Ещё не отмечено'
  if (type === 'tires') {
    const parts: string[] = []
    if (c.season) parts.push(SEASON_LABELS[c.season])
    if (c.treadDepthMm !== undefined) parts.push(`протектор ${c.treadDepthMm} мм`)
    if (c.pressureFront !== undefined || c.pressureRear !== undefined) {
      parts.push(`давление ${c.pressureFront ?? '—'}/${c.pressureRear ?? '—'} бар`)
    }
    return parts.join(' · ') || 'Отмечено без деталей'
  }
  if (type === 'battery') {
    return c.installedDate ? `Установлен ${fmtDate(c.installedDate)}` : 'Отмечено без даты установки'
  }
  return c.thicknessMm !== undefined ? `Толщина ${c.thicknessMm} мм` : 'Отмечено без деталей'
}

function checkedLabel(type: ComponentType): string | null {
  const c = props.latestByType[type]
  if (!c) return null
  return `Проверено ${fmtDate(c.date)} · ${fmtKm(c.mileage)} км`
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Компоненты</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item v-for="type in (Object.keys(COMPONENT_TYPE_LABELS) as ComponentType[])" :key="type" lines="full">
          <ion-icon slot="start" :icon="ICONS[type]" color="medium" />
          <ion-label class="ion-text-wrap">
            <h2>{{ COMPONENT_TYPE_LABELS[type] }}</h2>
            <p>{{ summary(type) }}</p>
            <p v-if="checkedLabel(type)"><ion-note>{{ checkedLabel(type) }}</ion-note></p>
          </ion-label>
          <ion-button slot="end" fill="outline" size="small" @click="emit('update', type)">Обновить</ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
