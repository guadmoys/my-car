<script setup lang="ts">
import type { TimelineEvent } from '../types'

defineProps<{
  events: TimelineEvent[]
}>()

const emit = defineEmits<{
  close: []
}>()

function eventIcon(event: TimelineEvent): string {
  return event.kind === 'fuel' ? '⛽' : '🔧'
}

function eventTitle(event: TimelineEvent): string {
  if (event.kind === 'fuel') return `Заправка · ${fmt(event.entry.liters)} л`
  return event.entry.itemName
}

function eventMeta(event: TimelineEvent): string {
  const parts = [fmt(event.mileage) + ' км', fmtDate(event.date)]
  if (event.entry.cost !== undefined) parts.push(fmtCost(event.entry.cost))
  return parts.join(' · ')
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtCost(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Закрыть</button>
        <h2>Все события</h2>
        <span class="spacer" />
      </div>

      <div class="list-wrap">
        <div class="card list">
          <div v-for="event in events" :key="`${event.kind}-${event.id}`" class="event-row">
            <span class="event-icon">{{ eventIcon(event) }}</span>
            <span class="event-info">
              <span class="event-title">{{ eventTitle(event) }}</span>
              <span class="event-meta">{{ eventMeta(event) }}</span>
            </span>
          </div>
          <div v-if="events.length === 0" class="empty">Пока нет событий</div>
        </div>
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
  z-index: 100;
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
  max-height: 85dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-grouped);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 8px 0 calc(20px + var(--safe-bottom));
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

.list-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 0;
}

.card {
  width: 100%;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow);
  overflow: hidden;
  text-align: left;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--separator);
}

.event-row:last-child {
  border-bottom: none;
}

.event-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.event-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.event-title {
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 15px;
}
</style>
