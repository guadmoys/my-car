<script setup lang="ts">
export type TabKey = 'dashboard' | 'maintenance' | 'fuel' | 'settings'

const props = defineProps<{
  activeTab: TabKey
  dueBadge: number
  carInitial?: string
}>()

const emit = defineEmits<{
  change: [tab: TabKey]
}>()

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Дашборд' },
  { key: 'maintenance', label: 'Замена' },
  { key: 'fuel', label: 'Расход' },
  { key: 'settings', label: 'Настройки' },
]
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: activeTab === tab.key, avatar: tab.key === 'settings' }"
      :aria-label="tab.label"
      @click="emit('change', tab.key)"
    >
      <span v-if="tab.key === 'settings'" class="avatar-badge" :class="{ active: activeTab === tab.key }">
        {{ props.carInitial ?? '🚗' }}
      </span>
      <span v-else class="icon-pill" :class="{ active: activeTab === tab.key }">
        <span class="icon-wrap">
          <svg v-if="tab.key === 'dashboard'" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path
              d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3a1 1 0 0 0 1-1v-9"
              :stroke="activeTab === tab.key ? 'var(--blue)' : 'currentColor'"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else-if="tab.key === 'maintenance'" viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path
              d="M14.7 6.3a4 4 0 0 0-5.4 4.6L4 16.2V20h3.8l5.3-5.3a4 4 0 0 0 4.6-5.4l-2.7 2.7-2-2 2.7-2.7Z"
              :stroke="activeTab === tab.key ? 'var(--blue)' : 'currentColor'"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path
              d="M5 20V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v14M4 20h10M15 9.5l2.6 2.1a1 1 0 0 1 .4.8V17a1.5 1.5 0 0 0 3 0v-4.2a2 2 0 0 0-.6-1.4L17.5 8.5"
              :stroke="activeTab === tab.key ? 'var(--blue)' : 'currentColor'"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M7 8h4"
              :stroke="activeTab === tab.key ? 'var(--blue)' : 'currentColor'"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
          <span v-if="tab.key === 'maintenance' && dueBadge > 0" class="badge">{{ dueBadge }}</span>
        </span>
      </span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(14px + var(--safe-bottom));
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 7px;
  border-radius: 30px;
  background: color-mix(in srgb, var(--bg-elevated) 90%, transparent);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--card-border);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.16),
    0 2px 8px rgba(0, 0, 0, 0.08);
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px 0;
  color: var(--text-tertiary);
}

.tab:active {
  opacity: 0.6;
}

.icon-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 9px 0;
  border-radius: 22px;
  transition: background 0.2s ease, color 0.2s ease;
}

.icon-pill.active {
  color: var(--blue);
  background: color-mix(in srgb, var(--blue) 14%, transparent);
}

.icon-wrap {
  position: relative;
  display: flex;
}

.badge {
  position: absolute;
  top: -4px;
  right: -9px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--red);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-badge {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--blue), #0040dd);
  border: 2px solid transparent;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.avatar-badge.active {
  border-color: var(--blue);
  transform: scale(1.08);
}
</style>
