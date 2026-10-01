<script setup lang="ts">
import { ref } from 'vue'
import { IonActionSheet, IonIcon } from '@ionic/vue'
import {
  add,
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
  <div class="tab-bar-row">
    <nav class="ios-tab-bar" role="tablist" aria-label="Разделы">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="tab-button"
        :class="{ selected: activeTab === tab.key }"
        :aria-selected="activeTab === tab.key"
        @click="select(tab.key)"
      >
        <span class="tab-icon-wrap">
          <ion-icon :icon="activeTab === tab.key ? tab.iconActive : tab.icon" />
          <span v-if="tab.key === 'maintenance' && dueBadge > 0" class="badge">{{ dueBadge }}</span>
        </span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>

      <button type="button" class="tab-button quick" aria-label="Быстрые действия" @click="openQuickActions">
        <span class="tab-icon-wrap">
          <span class="quick-circle"><ion-icon :icon="add" /></span>
        </span>
        <span class="tab-label">Добавить</span>
      </button>
    </nav>
  </div>

  <ion-action-sheet
    :is-open="showQuickActions"
    header="Быстрые действия"
    :buttons="quickActionButtons"
    @didDismiss="showQuickActions = false"
  />
</template>

<style scoped>
/* iOS-style tab bar: full-width, translucent with a hairline top border,
   icon over a small label, tinted when selected. Plain HTML because
   ion-tab-bar needs an ancestor IonTabs (this app has no router). */
.tab-bar-row {
  flex-shrink: 0;
  background: rgba(var(--ion-background-color-rgb, 255, 255, 255), 0.85);
  background: color-mix(in srgb, var(--ion-tab-bar-background, var(--ion-item-background, #ffffff)) 85%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid var(--ion-border-color, rgba(60, 60, 67, 0.29));
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.ios-tab-bar {
  display: flex;
  max-width: 560px;
  margin: 0 auto;
}

.tab-button {
  flex: 1;
  min-width: 0;
  min-height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 0 4px;
  margin: 0;
  background: none;
  border: none;
  color: var(--ion-color-medium);
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.15s ease;
}

.tab-button.selected {
  color: var(--ion-color-primary);
}

.tab-button:active .tab-icon-wrap {
  opacity: 0.6;
}

.tab-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
}

.tab-button ion-icon {
  font-size: 26px;
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 12px;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.badge {
  position: absolute;
  top: -2px;
  left: calc(50% + 6px);
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ion-color-danger);
  color: var(--ion-color-danger-contrast);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
}

.quick-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.quick-circle ion-icon {
  font-size: 20px;
}

.tab-button.quick {
  color: var(--ion-color-primary);
}
</style>
