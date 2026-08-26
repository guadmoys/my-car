<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  type SegmentCustomEvent,
} from '@ionic/vue'
import { add } from 'ionicons/icons'
import type { MaintenanceItem, MaintenanceStatus } from '../types'
import MaintenanceCard from './MaintenanceCard.vue'
import { haptic } from '../utils/haptics'
import { handlePullToRefresh } from '../utils/pullToRefresh'

const props = defineProps<{
  sortedStatuses: MaintenanceStatus[]
}>()

const emit = defineEmits<{
  markServiced: [id: string]
  edit: [id: string]
  delete: [id: string]
  bulkDelete: [ids: string[]]
  addItem: []
}>()

const search = ref('')

type Filter = 'all' | 'due' | 'soon' | 'ok'
const filter = ref<Filter>('all')
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'due', label: 'Просроч.' },
  { key: 'soon', label: 'Скоро' },
  { key: 'ok', label: 'Ок' },
]

function selectFilter(event: SegmentCustomEvent) {
  const key = event.detail.value as Filter
  if (filter.value === key) return
  haptic('tap')
  filter.value = key
}

function matchesQuery(item: MaintenanceItem, query: string): boolean {
  if (item.name.toLowerCase().includes(query)) return true
  return item.parts.some(
    (p) => p.name.toLowerCase().includes(query) || p.articleNumber.toLowerCase().includes(query),
  )
}

const searchQuery = computed(() => search.value.trim().toLowerCase())

const filteredStatuses = computed(() => {
  const query = searchQuery.value
  return props.sortedStatuses.filter((s) => {
    if (filter.value !== 'all' && s.state !== filter.value) return false
    if (query && !matchesQuery(s.item, query)) return false
    return true
  })
})

const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  selectedIds.value = new Set()
}

function toggleSelect(id: string) {
  haptic('tap')
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function bulkDelete() {
  emit('bulkDelete', Array.from(selectedIds.value))
  selectMode.value = false
  selectedIds.value = new Set()
}
</script>

<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>Замена</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="toggleSelectMode">{{ selectMode ? 'Отмена' : 'Выбрать' }}</ion-button>
      </ion-buttons>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="search" placeholder="Поиск по параметрам" />
    </ion-toolbar>
    <ion-toolbar>
      <ion-segment :value="filter" @ionChange="selectFilter">
        <ion-segment-button v-for="f in FILTERS" :key="f.key" :value="f.key">
          <ion-label>{{ f.label }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-toolbar>
  </ion-header>

  <ion-content :fullscreen="true">
    <ion-refresher slot="fixed" @ionRefresh="handlePullToRefresh">
      <ion-refresher-content></ion-refresher-content>
    </ion-refresher>

    <ion-list inset>
      <MaintenanceCard
        v-for="status in filteredStatuses"
        :key="status.item.id"
        :status="status"
        :selectable="selectMode"
        :selected="selectedIds.has(status.item.id)"
        @mark-serviced="emit('markServiced', $event)"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @select="toggleSelect"
      />
      <ion-item v-if="filteredStatuses.length === 0">
        <ion-label color="medium">
          {{ sortedStatuses.length === 0 ? 'Параметров пока нет' : 'Ничего не найдено' }}
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-toolbar v-if="selectMode && selectedIds.size > 0" class="bulk-bar">
      <ion-label slot="start">Выбрано: {{ selectedIds.size }}</ion-label>
      <ion-buttons slot="end">
        <ion-button color="danger" @click="bulkDelete">Удалить</ion-button>
      </ion-buttons>
    </ion-toolbar>

    <ion-fab v-if="!selectMode" vertical="bottom" horizontal="start" slot="fixed">
      <ion-fab-button @click="emit('addItem')">
        <ion-icon :icon="add" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<style scoped>
.bulk-bar {
  position: sticky;
  bottom: 0;
  --background: var(--ion-color-light);
}

/* "Просроч." is the tightest fit of the four segment labels at phone
   widths — trim the button's own padding so it stays on one line instead
   of ellipsis-truncating into an unreadable "ПРОС…". white-space: normal
   is a safety net for even narrower screens. */
ion-segment-button {
  --padding-start: 2px;
  --padding-end: 2px;
}

ion-segment-button ion-label {
  white-space: normal;
  font-size: 12px;
}
</style>
