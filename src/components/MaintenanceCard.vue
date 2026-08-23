<script setup lang="ts">
import { computed } from 'vue'
import type { MaintenanceStatus } from '../types'
import SwipeRow from './SwipeRow.vue'
import PartQuickLinks from './PartQuickLinks.vue'
import ToggleSwitch from './ToggleSwitch.vue'

const props = defineProps<{
  status: MaintenanceStatus
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  markServiced: [id: string]
  toggle: [id: string, enabled: boolean]
  edit: [id: string]
  delete: [id: string]
  select: [id: string]
}>()

const stateColor = computed(() => {
  switch (props.status.state) {
    case 'due':
      return 'var(--red)'
    case 'soon':
      return 'var(--orange)'
    default:
      return 'var(--green)'
  }
})

const rangeLabel = computed(() => {
  const { item } = props.status
  if (item.intervalKmMax) {
    return `${fmt(item.intervalKm)}–${fmt(item.intervalKmMax)} км`
  }
  return `${fmt(item.intervalKm)} км`
})

const statusLabel = computed(() => {
  const km = Math.abs(Math.round(props.status.remainingKm))
  if (props.status.remainingKm <= 0) {
    return km === 0 ? 'Пора провести ТО' : `Просрочено на ${fmt(km)} км`
  }
  return `Осталось ${fmt(km)} км`
})

const showBuyHint = computed(
  () => props.status.item.parts.length > 0 && props.status.state !== 'ok',
)

const DAY_MS = 24 * 60 * 60 * 1000

const dateLabel = computed(() => {
  const { item, remainingDays, estimatedDueDate } = props.status
  if (item.intervalMonths && remainingDays !== undefined) {
    const days = Math.abs(remainingDays)
    const prefix = remainingDays <= 0 ? `Просрочено на ${days} дн.` : `Осталось ${days} дн.`
    return `${prefix} · раз в ${item.intervalMonths} мес.`
  }
  if (estimatedDueDate !== undefined) {
    const daysUntil = Math.round((estimatedDueDate - Date.now()) / DAY_MS)
    if (daysUntil <= 0) return null
    return `≈ через ${daysUntil} дн. при вашем темпе езды`
  }
  return null
})

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <div class="item" :class="{ dimmed: !status.item.enabled && !selectable }">
    <button v-if="selectable" class="tap-target select-target" @click="emit('select', status.item.id)">
      <div class="row">
        <div class="checkbox" :class="{ checked: selected }">
          <svg v-if="selected" viewBox="0 0 24 24" width="13" height="13" fill="none">
            <path d="M5 13l4.5 4.5L19 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="dot" :style="{ background: stateColor }" />
        <div class="info">
          <div class="name">{{ status.item.name }}</div>
          <div class="meta">
            <span>{{ statusLabel }}</span>
            <span class="sep">·</span>
            <span>каждые {{ rangeLabel }}</span>
          </div>
        </div>
      </div>
    </button>
    <SwipeRow
      v-else
      :left-action="{ label: '✓ Готово', colorVar: 'var(--green)', onTrigger: () => emit('markServiced', status.item.id) }"
      :right-action="{ label: '🗑 Удалить', colorVar: 'var(--red)', onTrigger: () => emit('delete', status.item.id) }"
    >
      <button class="tap-target" @click="emit('edit', status.item.id)">
        <div class="row">
          <div class="dot" :style="{ background: stateColor }" />
          <div class="info">
            <div class="name">{{ status.item.name }}</div>
            <div class="meta">
              <span>{{ statusLabel }}</span>
              <span class="sep">·</span>
              <span>каждые {{ rangeLabel }}</span>
            </div>
            <div v-if="dateLabel" class="meta date-meta">
              <span>📅 {{ dateLabel }}</span>
            </div>
          </div>
          <div class="chevron">›</div>
        </div>
        <div class="track">
          <div
            class="fill"
            :style="{ width: `${status.progress * 100}%`, background: stateColor }"
          />
        </div>
      </button>
    </SwipeRow>
    <div v-if="!selectable" class="actions">
      <button class="done" @click="emit('markServiced', status.item.id)">
        Выполнено
      </button>
      <ToggleSwitch
        :checked="status.item.enabled"
        :aria-label="`Учитывать «${status.item.name}»`"
        @update:checked="(v) => emit('toggle', status.item.id, v)"
      />
    </div>

    <div v-if="showBuyHint && !selectable" class="buy-hint" :style="{ borderColor: stateColor }">
      <div class="buy-hint-title" :style="{ color: stateColor }">
        🛒 Пора купить {{ status.item.parts.length > 1 ? 'детали' : 'деталь' }}
      </div>
      <div v-for="part in status.item.parts" :key="part.id" class="part-row">
        <div class="part-row-top">
          <div class="part-info">
            <div class="part-name">{{ part.name }}</div>
            <div class="part-meta">
              {{ [part.articleNumber, part.platform].filter(Boolean).join(' · ') || '—' }}
            </div>
          </div>
          <a
            v-if="part.url"
            :href="part.url"
            target="_blank"
            rel="noopener noreferrer"
            class="part-buy"
            @click.stop
          >
            Купить ›
          </a>
        </div>
        <PartQuickLinks :part="part" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.item {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--separator);
  transition: opacity 0.2s;
}

.item:last-child {
  border-bottom: none;
}

.item.dimmed {
  opacity: 0.45;
}

.tap-target {
  width: 100%;
  display: block;
  text-align: left;
  padding: 0;
  background: var(--bg-elevated);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.select-target {
  background: var(--bg-elevated);
}

.checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--separator);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--motion-fast), border-color var(--motion-fast);
}

.checkbox.checked {
  background: var(--blue);
  border-color: var(--blue);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.sep {
  margin: 0 4px;
}

.chevron {
  color: var(--text-tertiary);
  font-size: 18px;
  font-weight: 500;
}

.track {
  height: 5px;
  border-radius: 3px;
  background: var(--fill-secondary);
  margin-top: 10px;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.done {
  font-size: 13px;
  font-weight: 600;
  color: var(--blue);
  background: color-mix(in srgb, var(--blue) 12%, transparent);
  padding: 6px 12px;
  border-radius: var(--radius-pill);
}

.done:active {
  opacity: 0.6;
}

.buy-hint {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid;
  background: var(--fill-secondary);
}

.buy-hint-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
}

.part-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 5px 0;
}

.part-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.part-info {
  min-width: 0;
}

.part-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.part-meta {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.part-buy {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--blue);
  background: color-mix(in srgb, var(--blue) 12%, transparent);
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  text-decoration: none;
}

.part-buy:active {
  opacity: 0.6;
}
</style>
