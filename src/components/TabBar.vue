<script setup lang="ts">
import { ref } from 'vue'
import { IonActionSheet, IonBadge, IonFabButton, IonIcon } from '@ionic/vue'
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
  <div class="tab-bar-wrapper">
    <ion-fab-button
      class="quick-action-button"
      size="small"
      aria-label="Быстрые действия"
      @click="openQuickActions"
    >
      <ion-icon :icon="add" />
    </ion-fab-button>

    <ion-tab-bar :selected-tab="activeTab" translucent>
      <ion-tab-button
        v-for="tab in tabs"
        :key="tab.key"
        :tab="tab.key"
        :selected="activeTab === tab.key"
        :aria-label="tab.label"
        @click="select(tab.key)"
      >
        <ion-icon :icon="activeTab === tab.key ? tab.iconActive : tab.icon" />
        <ion-badge v-if="tab.key === 'maintenance' && dueBadge > 0" color="danger">{{ dueBadge }}</ion-badge>
      </ion-tab-button>
    </ion-tab-bar>
  </div>

  <ion-action-sheet
    :is-open="showQuickActions"
    header="Быстрые действия"
    :buttons="quickActionButtons"
    @didDismiss="showQuickActions = false"
  />
</template>

<style scoped>
.tab-bar-wrapper {
  position: relative;
}

ion-tab-button.tab-selected::part(native) {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  border-radius: 14px;
  margin: 6px 10px;
  width: auto;
}

.quick-action-button {
  position: absolute;
  right: 16px;
  bottom: 100%;
  margin-bottom: 12px;
  --box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}
</style>
