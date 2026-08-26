<script setup lang="ts">
import { ref } from 'vue'
import { IonActionSheet, IonIcon } from '@ionic/vue'
import {
  add,
  alarmOutline,
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
  { text: 'Напоминание', icon: alarmOutline, handler: () => emit('quickReminder') },
  { text: 'Отмена', role: 'cancel' },
]
</script>

<template>
  <div class="tab-bar-row">
    <nav class="floating-tab-bar" role="tablist" aria-label="Разделы">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="tab-button"
        :class="{ selected: activeTab === tab.key }"
        :aria-selected="activeTab === tab.key"
        :aria-label="tab.label"
        @click="select(tab.key)"
      >
        <span class="tab-icon-wrap">
          <ion-icon :icon="activeTab === tab.key ? tab.iconActive : tab.icon" />
          <span v-if="tab.key === 'maintenance' && dueBadge > 0" class="badge">{{ dueBadge }}</span>
        </span>
      </button>
    </nav>

    <button type="button" class="quick-action-button" aria-label="Быстрые действия" @click="openQuickActions">
      <ion-icon :icon="add" />
    </button>
  </div>

  <ion-action-sheet
    :is-open="showQuickActions"
    header="Быстрые действия"
    :buttons="quickActionButtons"
    @didDismiss="showQuickActions = false"
  />
</template>

<style scoped>
/* Plain HTML/CSS tab bar (no ion-tab-bar/ion-tab-button) — those require an
   ancestor IonTabs to register properly, which this app's manual-tabs
   navigation doesn't have. Colors/spacing still come from the app's Ionic
   CSS-variable theme, so it stays visually part of the same design system. */
.tab-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px calc(env(safe-area-inset-bottom, 0) + 8px);
}

.floating-tab-bar {
  flex: 1;
  display: flex;
  border-radius: 28px;
  background: var(--ion-tab-bar-background, var(--ion-item-background, #ffffff));
  background: color-mix(in srgb, var(--ion-item-background, #ffffff) 88%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  background: none;
  border: none;
  padding: 6px;
  margin: 0;
  color: var(--ion-color-medium);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.tab-button ion-icon {
  font-size: 24px;
}

.tab-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 20px;
  transition: background-color 0.15s ease;
}

.tab-button.selected {
  color: var(--ion-color-primary);
}

.tab-button.selected .tab-icon-wrap {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
}

.badge {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--ion-color-danger);
  color: var(--ion-color-danger-contrast);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

.quick-action-button {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.quick-action-button ion-icon {
  font-size: 20px;
}
</style>
