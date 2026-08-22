<script setup lang="ts">
import { computed } from 'vue'
import type { MaintenanceStatus } from '../types'
import SwipeRow from './SwipeRow.vue'

const props = defineProps<{
  status: MaintenanceStatus
}>()

const emit = defineEmits<{
  markServiced: [id: string]
  toggle: [id: string, enabled: boolean]
  edit: [id: string]
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

const dateLabel = computed(() => {
  const { item, remainingDays } = props.status
  if (!item.intervalMonths || remainingDays === undefined) return null
  const days = Math.abs(remainingDays)
  const prefix = remainingDays <= 0 ? `Просрочено на ${days} дн.` : `Осталось ${days} дн.`
  return `${prefix} · раз в ${item.intervalMonths} мес.`
})

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}
</script>

<template>
  <div class="item" :class="{ dimmed: !status.item.enabled }">
    <SwipeRow
      :left-action="{ label: '✓ Готово', colorVar: 'var(--green)', onTrigger: () => emit('markServiced', status.item.id) }"
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
    <div class="actions">
      <button class="done" @click="emit('markServiced', status.item.id)">
        Выполнено
      </button>
      <label class="switch">
        <input
          type="checkbox"
          :checked="status.item.enabled"
          @change="emit('toggle', status.item.id, ($event.target as HTMLInputElement).checked)"
        />
        <span class="slider" />
      </label>
    </div>

    <div v-if="showBuyHint" class="buy-hint" :style="{ borderColor: stateColor }">
      <div class="buy-hint-title" :style="{ color: stateColor }">
        🛒 Пора купить {{ status.item.parts.length > 1 ? 'детали' : 'деталь' }}
      </div>
      <div v-for="part in status.item.parts" :key="part.id" class="part-row">
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

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  background: var(--fill-secondary);
  border-radius: 13px;
  transition: background 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.switch input:checked + .slider {
  background: var(--green);
}

.switch input:checked + .slider::before {
  transform: translateX(18px);
}

.buy-hint {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
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
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 0;
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
  border-radius: 8px;
  text-decoration: none;
}

.part-buy:active {
  opacity: 0.6;
}
</style>
