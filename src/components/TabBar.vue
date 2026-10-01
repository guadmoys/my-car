<script setup lang="ts">
import { ref } from 'vue'
import { IonActionSheet, IonBadge, IonIcon, IonLabel, IonTabBar, IonTabButton } from '@ionic/vue'
import {
  addCircle,
  alarmOutline,
  cashOutline,
  construct,
  constructOutline,
  home,
  homeOutline,
  settings,
  settingsOutline,
  speedometerOutline,
  water,
  waterOutline,
} from 'ionicons/icons'
import { haptic } from '../utils/haptics'

export type TabKey = 'dashboard' | 'maintenance' | 'fuel' | 'settings'

const props = defineProps<{
  activeTab: TabKey
  dueBadge: number
}>()

const emit = defineEmits<{
  change: [tab: TabKey]
  quickMileage: []
  quickFuel: []
  quickReminder: []
  quickExpense: []
}>()

const tabs: { key: TabKey; label: string; icon: string; iconActive: string }[] = [
  { key: 'dashboard', label: 'Дашборд', icon: homeOutline, iconActive: home },
  { key: 'maintenance', label: 'Замена', icon: constructOutline, iconActive: construct },
  { key: 'fuel', label: 'Расход', icon: waterOutline, iconActive: water },
  { key: 'settings', label: 'Настройки', icon: settingsOutline, iconActive: settings },
]

function select(tab: TabKey) {
  if (tab !== props.activeTab) haptic('tap')
  emit('change', tab)
}

const showQuickActions = ref(false)

function openQuickActions() {
  haptic('tap')
  showQuickActions.value = true
}

const quickActionButtons = [
  { text: 'Пробег', icon: speedometerOutline, handler: () => emit('quickMileage') },
  { text: 'Заправка', icon: water, handler: () => emit('quickFuel') },
  { text: 'Расход', icon: cashOutline, handler: () => emit('quickExpense') },
  { text: 'Напоминание', icon: alarmOutline, handler: () => emit('quickReminder') },
  { text: 'Отмена', role: 'cancel' },
]
</script>

<template>
  <ion-tab-bar :selected-tab="activeTab" slot="bottom">
    <ion-tab-button tab="dashboard" @click="select('dashboard')">
      <ion-icon :icon="activeTab === 'dashboard' ? tabs[0].iconActive : tabs[0].icon" aria-hidden="true" />
      <ion-label>{{ tabs[0].label }}</ion-label>
    </ion-tab-button>

    <ion-tab-button tab="maintenance" @click="select('maintenance')">
      <ion-icon :icon="activeTab === 'maintenance' ? tabs[1].iconActive : tabs[1].icon" aria-hidden="true" />
      <ion-label>{{ tabs[1].label }}</ion-label>
      <ion-badge v-if="dueBadge > 0" color="danger">{{ dueBadge }}</ion-badge>
    </ion-tab-button>

    <ion-tab-button tab="fuel" @click="select('fuel')">
      <ion-icon :icon="activeTab === 'fuel' ? tabs[2].iconActive : tabs[2].icon" aria-hidden="true" />
      <ion-label>{{ tabs[2].label }}</ion-label>
    </ion-tab-button>

    <ion-tab-button tab="settings" @click="select('settings')">
      <ion-icon :icon="activeTab === 'settings' ? tabs[3].iconActive : tabs[3].icon" aria-hidden="true" />
      <ion-label>{{ tabs[3].label }}</ion-label>
    </ion-tab-button>

    <ion-tab-button tab="quick-actions" aria-label="Быстрые действия" @click="openQuickActions">
      <ion-icon :icon="addCircle" aria-hidden="true" />
      <ion-label>Добавить</ion-label>
    </ion-tab-button>
  </ion-tab-bar>

  <ion-action-sheet
    :is-open="showQuickActions"
    header="Быстрые действия"
    :buttons="quickActionButtons"
    @didDismiss="showQuickActions = false"
  />
</template>
