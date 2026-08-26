<script setup lang="ts">
import { ref } from 'vue'
import { IonActionSheet, IonBadge, IonFabButton, IonIcon, IonLabel } from '@ionic/vue'
import {
  add,
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
  { text: 'Отмена', role: 'cancel' },
]
</script>

<template>
  <div class="tab-bar-row">
    <ion-tab-bar :selected-tab="activeTab" translucent class="floating-tab-bar">
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

    <ion-fab-button class="quick-action-button" size="small" @click="openQuickActions">
      <ion-icon :icon="add" />
    </ion-fab-button>
  </div>

  <ion-action-sheet
    :is-open="showQuickActions"
    header="Быстрые действия"
    :buttons="quickActionButtons"
    @didDismiss="showQuickActions = false"
  />
</template>

<style scoped>
.tab-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px calc(env(safe-area-inset-bottom, 0) + 8px);
}

.floating-tab-bar {
  flex: 1;
  border-radius: 28px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.floating-tab-bar ion-tab-button.tab-selected::part(native) {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  border-radius: 20px;
  margin: 6px;
  width: auto;
}

.quick-action-button {
  flex-shrink: 0;
  --box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
</style>
