<script setup lang="ts">
import { IonBadge, IonIcon, IonLabel } from '@ionic/vue'
import {
  construct,
  constructOutline,
  home,
  homeOutline,
  settings,
  settingsOutline,
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
</script>

<template>
  <ion-tab-bar :selected-tab="activeTab">
    <ion-tab-button
      v-for="tab in tabs"
      :key="tab.key"
      :tab="tab.key"
      :selected="activeTab === tab.key"
      @click="select(tab.key)"
    >
      <ion-icon :icon="activeTab === tab.key ? tab.iconActive : tab.icon" />
      <ion-label>{{ tab.label }}</ion-label>
      <ion-badge v-if="tab.key === 'maintenance' && dueBadge > 0" color="danger">{{ dueBadge }}</ion-badge>
    </ion-tab-button>
  </ion-tab-bar>
</template>
