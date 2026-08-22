<script setup lang="ts">
export type TabKey = 'dashboard' | 'maintenance' | 'fuel' | 'settings'

defineProps<{
  activeTab: TabKey
  dueBadge: number
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
      :class="{ active: activeTab === tab.key }"
      @click="emit('change', tab.key)"
    >
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
        <svg v-else-if="tab.key === 'fuel'" viewBox="0 0 24 24" width="24" height="24" fill="none">
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
        <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="3.2"
            :stroke="activeTab === tab.key ? 'var(--blue)' : 'currentColor'"
            stroke-width="1.8"
          />
          <path
            d="M19.4 13.5c.1-.5.1-1 0-1.5.5-.4.9-.9 1.2-1.4l-1.5-2.6c-.6.2-1.2.4-1.7.6-.4-.3-.8-.6-1.3-.8-.1-.6-.3-1.2-.5-1.8h-3c-.2.6-.4 1.2-.5 1.8-.5.2-.9.5-1.3.8-.5-.2-1.1-.4-1.7-.6l-1.5 2.6c.3.5.7 1 1.2 1.4-.1.5-.1 1 0 1.5-.5.4-.9.9-1.2 1.4l1.5 2.6c.6-.2 1.2-.4 1.7-.6.4.3.8.6 1.3.8.1.6.3 1.2.5 1.8h3c.2-.6.4-1.2.5-1.8.5-.2.9-.5 1.3-.8.5.2 1.1.4 1.7.6l1.5-2.6c-.3-.5-.7-1-1.2-1.4Z"
            :stroke="activeTab === tab.key ? 'var(--blue)' : 'currentColor'"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
        <span v-if="tab.key === 'maintenance' && dueBadge > 0" class="badge">{{ dueBadge }}</span>
      </span>
      <span class="label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  padding: 6px 4px calc(6px + var(--safe-bottom));
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--card-border);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0 2px;
  color: var(--text-tertiary);
}

.tab.active {
  color: var(--blue);
}

.tab:active {
  opacity: 0.6;
}

.icon-wrap {
  position: relative;
  display: flex;
}

.badge {
  position: absolute;
  top: -4px;
  right: -8px;
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

.label {
  font-size: 10px;
  font-weight: 500;
}
</style>
