<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
  type SegmentCustomEvent,
} from '@ionic/vue'
import { add, caretDownOutline, caretUpOutline } from 'ionicons/icons'
import type { MaintenanceItem, MaintenanceStatus } from '../types'
import MaintenanceCard from './MaintenanceCard.vue'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  sortedStatuses: MaintenanceStatus[]
  disabledItems: MaintenanceItem[]
}>()

const emit = defineEmits<{
  markServiced: [id: string]
  toggle: [id: string, enabled: boolean]
  bulkToggle: [ids: string[], enabled: boolean]
  edit: [id: string]
  delete: [id: string]
  reorderDisabled: [id: string, direction: 'up' | 'down']
  addItem: []
}>()

const showDisabled = ref(false)
const search = ref('')

type Filter = 'all' | 'due' | 'soon' | 'ok'
const filter = ref<Filter>('all')
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'due', label: 'Просрочено' },
  { key: 'soon', label: 'Скоро' },
  { key: 'ok', label: 'В порядке' },
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

const filteredDisabledItems = computed(() => {
  const query = searchQuery.value
  if (!query) return props.disabledItems
  return props.disabledItems.filter((item) => matchesQuery(item, query))
})

const disabledSectionOpen = computed(
  () => showDisabled.value || (searchQuery.value !== '' && filteredDisabledItems.value.length > 0),
)

const accordionValue = computed<string | undefined>({
  get: () => (disabledSectionOpen.value ? 'disabled' : undefined),
  set: (v) => {
    showDisabled.value = v === 'disabled'
  },
})

// Reordering acts on the full disabled order, so it's hidden while a search
// query narrows which neighbours are even visible.
const canReorder = computed(() => searchQuery.value === '')

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

function bulkSetEnabled(enabled: boolean) {
  emit('bulkToggle', Array.from(selectedIds.value), enabled)
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
    <ion-list inset>
      <MaintenanceCard
        v-for="status in filteredStatuses"
        :key="status.item.id"
        :status="status"
        :selectable="selectMode"
        :selected="selectedIds.has(status.item.id)"
        @mark-serviced="emit('markServiced', $event)"
        @toggle="(id, enabled) => emit('toggle', id, enabled)"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @select="toggleSelect"
      />
      <ion-item v-if="filteredStatuses.length === 0">
        <ion-label color="medium">
          {{ sortedStatuses.length === 0 ? 'Все параметры отключены' : 'Ничего не найдено' }}
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-accordion-group v-if="disabledItems.length > 0" v-model="accordionValue">
      <ion-accordion value="disabled">
        <ion-item slot="header">
          <ion-label>Отключено ({{ disabledItems.length }})</ion-label>
        </ion-item>
        <ion-list slot="content">
          <ion-item v-for="(item, index) in filteredDisabledItems" :key="item.id">
            <ion-checkbox
              v-if="selectMode"
              slot="start"
              :checked="selectedIds.has(item.id)"
              @ion-change="toggleSelect(item.id)"
            />
            <ion-label @click="!selectMode && emit('edit', item.id)">{{ item.name }}</ion-label>
            <template v-if="!selectMode">
              <ion-buttons v-if="canReorder" slot="end">
                <ion-button
                  size="small"
                  fill="clear"
                  :disabled="index === 0"
                  aria-label="Переместить выше"
                  @click="emit('reorderDisabled', item.id, 'up')"
                >
                  <ion-icon slot="icon-only" :icon="caretUpOutline" />
                </ion-button>
                <ion-button
                  size="small"
                  fill="clear"
                  :disabled="index === filteredDisabledItems.length - 1"
                  aria-label="Переместить ниже"
                  @click="emit('reorderDisabled', item.id, 'down')"
                >
                  <ion-icon slot="icon-only" :icon="caretDownOutline" />
                </ion-button>
              </ion-buttons>
              <ion-toggle
                slot="end"
                :checked="item.enabled"
                :aria-label="`Учитывать «${item.name}»`"
                @ion-change="(e) => emit('toggle', item.id, e.detail.checked)"
              />
            </template>
          </ion-item>
          <ion-item v-if="filteredDisabledItems.length === 0">
            <ion-label color="medium">Ничего не найдено</ion-label>
          </ion-item>
        </ion-list>
      </ion-accordion>
    </ion-accordion-group>

    <ion-toolbar v-if="selectMode && selectedIds.size > 0" class="bulk-bar">
      <ion-label slot="start">Выбрано: {{ selectedIds.size }}</ion-label>
      <ion-buttons slot="end">
        <ion-button @click="bulkSetEnabled(true)">Включить</ion-button>
        <ion-button color="danger" @click="bulkSetEnabled(false)">Отключить</ion-button>
      </ion-buttons>
    </ion-toolbar>

    <ion-fab v-if="!selectMode" vertical="bottom" horizontal="end" slot="fixed">
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
</style>
