<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  title: string
  items: string[]
  selected?: string
  placeholder?: string
  /** Label for the row that lets the user use their own typed value instead of picking one from the list. */
  customLabel: string
}>()

const emit = defineEmits<{
  close: []
  select: [value: string]
}>()

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.items
  return props.items.filter((item) => item.toLowerCase().includes(q))
})

const exactMatch = computed(() =>
  props.items.some((item) => item.toLowerCase() === search.value.trim().toLowerCase())
)

function pick(value: string) {
  emit('select', value)
  emit('close')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Закрыть</button>
        <h2>{{ title }}</h2>
        <span class="spacer" />
      </div>

      <div class="search-row">
        <svg class="search-icon" viewBox="0 0 24 24" width="17" height="17" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" />
          <path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input v-model="search" type="text" :placeholder="placeholder" autocapitalize="words" />
        <button v-if="search" class="search-clear" aria-label="Очистить" @click="search = ''">✕</button>
      </div>

      <div class="list">
        <button
          v-if="search.trim() && !exactMatch"
          class="row custom-row"
          @click="pick(search.trim())"
        >
          {{ customLabel }} «{{ search.trim() }}»
        </button>
        <button
          v-for="item in filtered"
          :key="item"
          class="row"
          :class="{ active: item === selected }"
          @click="pick(item)"
        >
          <span>{{ item }}</span>
          <span class="check" :class="{ visible: item === selected }">✓</span>
        </button>
        <p v-if="!filtered.length && !search.trim()" class="empty">Список пуст</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 200;
  animation: fade-in 0.15s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.sheet {
  width: 100%;
  height: 82dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-grouped);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 8px 0 calc(12px + var(--safe-bottom));
  animation: slide-up 0.25s var(--motion-spring);
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.handle {
  width: 36px;
  height: 5px;
  border-radius: 3px;
  background: var(--text-tertiary);
  margin: 6px auto 4px;
  opacity: 0.5;
  flex-shrink: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 4px;
  flex-shrink: 0;
}

.header h2 {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.cancel {
  font-size: 17px;
  color: var(--blue);
}

.spacer {
  width: 56px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 16px 12px;
  padding: 9px 14px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
  flex-shrink: 0;
}

.search-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-row input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--text);
  outline: none;
}

.search-row input::placeholder {
  color: var(--text-tertiary);
}

.search-clear {
  color: var(--text-tertiary);
  font-size: 13px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--card-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 13px 4px;
  font-size: 16px;
  text-align: left;
  border-bottom: 1px solid var(--separator);
  color: var(--text);
}

.row:active {
  opacity: 0.6;
}

.custom-row {
  color: var(--blue);
  font-weight: 500;
}

.check {
  color: var(--blue);
  font-weight: 700;
  opacity: 0;
  flex-shrink: 0;
}

.check.visible {
  opacity: 1;
}

.empty {
  padding: 24px 4px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}
</style>
