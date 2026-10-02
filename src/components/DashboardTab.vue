<script setup lang="ts">
import { formatMoney } from '../utils/currency'
import { computed } from 'vue'
import {
  IonButton,
  IonCard,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { add, alarmOutline, checkmarkCircleOutline, construct, ellipse, folderOutline, shieldCheckmarkOutline, speedometerOutline, walletOutline, water } from 'ionicons/icons'
import { DOCUMENT_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from '../types'
import type { Car, DocumentStatus, MaintenanceStatus, ReminderStatus, TimelineEvent } from '../types'
import { expiryLabel, statusColor } from '../utils/documents'
import SummaryCard from './SummaryCard.vue'
import ReminderCard from './ReminderCard.vue'
import { handlePullToRefresh } from '../utils/pullToRefresh'

const props = defineProps<{
  car: Car
  okCount: number
  soonCount: number
  dueCount: number
  averageConsumption: number | null
  latestConsumption: number | null
  monthDistanceKm: number | null
  recentEvents: TimelineEvent[]
  eventsTotal: number
  totalFuelCost: number
  totalServiceCost: number
  totalExpensesCost: number
  totalCost: number
  hasAnyCost: boolean
  urgentStatuses: MaintenanceStatus[]
  urgentTotal: number
  estimatedRangeKm: number | null
  reminderStatuses: ReminderStatus[]
  documentStatuses: DocumentStatus[]
  documentCount: number
}>()

// The three most urgent dated documents; the full list lives in the Documents sheet.
const documentPreview = computed(() => props.documentStatuses.slice(0, 3))

const monthName = computed(() =>
  new Date().toLocaleDateString('ru-RU', { month: 'long' }),
)

function eventIcon(event: TimelineEvent): string {
  if (event.kind === 'expense') return walletOutline
  return event.kind === 'fuel' ? water : construct
}

function eventTitle(event: TimelineEvent): string {
  if (event.kind === 'fuel') return `Заправка · ${fmt(event.entry.liters)} л`
  if (event.kind === 'expense') return event.entry.title || EXPENSE_CATEGORY_LABELS[event.entry.category]
  return event.entry.itemName
}

function eventMeta(event: TimelineEvent): string {
  const parts = event.mileage === null ? [fmtDate(event.date)] : [fmt(event.mileage) + ' км', fmtDate(event.date)]
  const cost = event.kind === 'expense' ? event.entry.amount : event.entry.cost
  if (cost !== undefined) parts.push(fmtCost(cost))
  return parts.join(' · ')
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// Low-fuel threshold matches the "скоро на заправку" cutoff already used
// for the fuelInsights range warning, so this card and that insight agree.
const LOW_FUEL_RANGE_KM = 60

type PriorityAction =
  | { kind: 'maintenance'; status: MaintenanceStatus }
  | { kind: 'fuel'; rangeKm: number }
  | { kind: 'ok' }

// A single top recommendation, folding maintenance urgency and fuel range
// into one place instead of making the user check both the urgent-items
// list and the Заправки tab separately. urgentStatuses is already
// urgency-sorted (due before soon, most overdue first), so its first
// matching entry is the single most urgent one of that kind.
const priorityAction = computed<PriorityAction>(() => {
  const topDue = props.urgentStatuses.find((s) => s.state === 'due')
  if (topDue) return { kind: 'maintenance', status: topDue }
  if (props.estimatedRangeKm !== null && props.estimatedRangeKm <= LOW_FUEL_RANGE_KM) {
    return { kind: 'fuel', rangeKm: props.estimatedRangeKm }
  }
  const topSoon = props.urgentStatuses.find((s) => s.state === 'soon')
  if (topSoon) return { kind: 'maintenance', status: topSoon }
  return { kind: 'ok' }
})

const emit = defineEmits<{
  editMileage: []
  switchCar: []
  quickFuel: []
  openItem: [id: string]
  markServiced: [id: string]
  viewAllMaintenance: []
  viewAllFuel: []
  viewAllEvents: []
  addReminder: []
  deleteReminder: [id: string]
  viewOtherExpenses: []
  openDocuments: []
}>()

function stateColor(state: MaintenanceStatus['state']): string {
  return state
}

function statusText(status: MaintenanceStatus): string {
  const km = Math.abs(Math.round(status.remainingKm))
  if (status.remainingDays !== undefined && status.remainingDays <= 0) {
    return `Просрочено по дате на ${Math.abs(status.remainingDays)} дн.`
  }
  if (status.remainingKm <= 0) {
    return km === 0 ? 'Пора провести ТО' : `Просрочено на ${fmt(km)} км`
  }
  if (status.remainingDays !== undefined && status.state === 'soon') {
    return `Осталось ${status.remainingDays} дн. или ${fmt(km)} км`
  }
  return `Осталось ${fmt(km)} км`
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtCost(n: number): string {
  return formatMoney(n)
}
</script>

<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>Обзор</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content :fullscreen="true">
    <ion-refresher slot="fixed" @ionRefresh="handlePullToRefresh">
      <ion-refresher-content></ion-refresher-content>
    </ion-refresher>

    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">Обзор</ion-title>
      </ion-toolbar>
    </ion-header>

    <SummaryCard
      :car="car"
      :ok-count="okCount"
      :soon-count="soonCount"
      :due-count="dueCount"
      :average-consumption="averageConsumption"
      @edit-mileage="emit('editMileage')"
      @switch-car="emit('switchCar')"
    />

    <ion-grid>
      <ion-row>
        <ion-col>
          <ion-button expand="block" fill="outline" @click="emit('editMileage')">
            <ion-icon slot="start" :icon="speedometerOutline" />
            Пробег
          </ion-button>
        </ion-col>
        <ion-col>
          <ion-button expand="block" fill="outline" @click="emit('quickFuel')">
            <ion-icon slot="start" :icon="water" />
            Заправка
          </ion-button>
        </ion-col>
      </ion-row>
    </ion-grid>

    <ion-grid v-if="averageConsumption !== null || monthDistanceKm !== null">
      <ion-row>
        <ion-col v-if="averageConsumption !== null">
          <ion-card class="stat-card">
            <div class="stat-headline">
              {{ (latestConsumption ?? averageConsumption).toFixed(1) }}
              <span class="stat-unit">л/100км</span>
            </div>
            <ion-note>Сред.: {{ averageConsumption.toFixed(1) }} л/100км</ion-note>
          </ion-card>
        </ion-col>
        <ion-col v-if="monthDistanceKm !== null">
          <ion-card class="stat-card">
            <div class="stat-headline">
              {{ fmt(monthDistanceKm) }}
              <span class="stat-unit">км</span>
            </div>
            <ion-note>За {{ monthName }}</ion-note>
          </ion-card>
        </ion-col>
      </ion-row>
    </ion-grid>

    <ion-list v-if="priorityAction.kind !== 'ok'" inset>
      <ion-list-header>Сделать сейчас</ion-list-header>
      <ion-item
        button
        :detail="priorityAction.kind === 'fuel'"
        :color="priorityAction.kind === 'fuel' ? 'danger' : priorityAction.status.state"
        @click="
          priorityAction.kind === 'fuel' ? emit('quickFuel') : emit('openItem', priorityAction.status.item.id)
        "
      >
        <ion-icon slot="start" :icon="priorityAction.kind === 'fuel' ? water : construct" />
        <ion-label>
          <h2>{{ priorityAction.kind === 'fuel' ? 'Залить топливо' : priorityAction.status.item.name }}</h2>
          <p>
            {{
              priorityAction.kind === 'fuel'
                ? `Осталось ~${Math.round(priorityAction.rangeKm)} км хода`
                : statusText(priorityAction.status)
            }}
          </p>
        </ion-label>
        <ion-button
          v-if="priorityAction.kind === 'maintenance'"
          slot="end"
          size="small"
          fill="outline"
          @click.stop="emit('markServiced', priorityAction.status.item.id)"
        >
          Готово
        </ion-button>
      </ion-item>
    </ion-list>

    <ion-list inset>
      <ion-list-header>
        <ion-label>Напоминания</ion-label>
        <ion-button fill="clear" size="small" @click="emit('addReminder')">
          <ion-icon slot="icon-only" :icon="add" />
        </ion-button>
      </ion-list-header>
      <ReminderCard
        v-for="status in reminderStatuses"
        :key="status.reminder.id"
        :status="status"
        @delete="emit('deleteReminder', $event)"
      />
      <ion-item v-if="reminderStatuses.length === 0" button :detail="false" lines="none" @click="emit('addReminder')">
        <ion-icon slot="start" :icon="alarmOutline" color="medium" />
        <ion-label color="medium">Например: «через 300км проверить масло»</ion-label>
      </ion-item>
    </ion-list>

    <ion-list inset>
      <ion-list-header>
        <ion-label>Документы</ion-label>
        <ion-button fill="clear" size="small" @click="emit('openDocuments')">
          {{ documentCount > 0 ? 'Все' : 'Добавить' }}
        </ion-button>
      </ion-list-header>
      <ion-item
        v-for="s in documentPreview"
        :key="s.document.id"
        button
        detail
        @click="emit('openDocuments')"
      >
        <ion-icon slot="start" :icon="shieldCheckmarkOutline" :color="statusColor(s) ?? 'medium'" />
        <ion-label>
          <h2>{{ s.document.title || DOCUMENT_TYPE_LABELS[s.document.type] }}</h2>
          <p :class="{ 'due-text': s.isDue, 'soon-text': s.isSoon }">{{ expiryLabel(s) }}</p>
        </ion-label>
      </ion-item>
      <ion-item v-if="documentPreview.length === 0" button :detail="false" lines="none" @click="emit('openDocuments')">
        <ion-icon slot="start" :icon="folderOutline" color="medium" />
        <ion-label color="medium" class="ion-text-wrap">
          {{ documentCount > 0 ? `Документов: ${documentCount}, сроков действия нет` : 'СТС, страховка, техосмотр — с фото и напоминаниями' }}
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-list v-if="hasAnyCost" inset>
      <ion-list-header>Расходы</ion-list-header>
      <ion-item button detail @click="emit('viewAllFuel')">
        <ion-label>Топливо</ion-label>
        <ion-note slot="end">{{ fmtCost(totalFuelCost) }}</ion-note>
      </ion-item>
      <ion-item button detail @click="emit('viewAllMaintenance')">
        <ion-label>ТО</ion-label>
        <ion-note slot="end">{{ fmtCost(totalServiceCost) }}</ion-note>
      </ion-item>
      <ion-item v-if="totalExpensesCost > 0" button detail @click="emit('viewOtherExpenses')">
        <ion-label>Прочее</ion-label>
        <ion-note slot="end">{{ fmtCost(totalExpensesCost) }}</ion-note>
      </ion-item>
      <ion-item button detail @click="emit('viewAllFuel')">
        <ion-label><strong>Итого</strong></ion-label>
        <ion-note slot="end" color="primary"><strong>{{ fmtCost(totalCost) }}</strong></ion-note>
      </ion-item>
    </ion-list>

    <ion-list inset>
      <ion-list-header>Требует внимания</ion-list-header>
      <ion-item
        v-for="status in urgentStatuses"
        :key="status.item.id"
        button
        detail
        @click="emit('openItem', status.item.id)"
      >
        <ion-icon slot="start" :icon="ellipse" :color="stateColor(status.state)" />
        <ion-label>
          <h2>{{ status.item.name }}</h2>
          <p>{{ statusText(status) }}</p>
        </ion-label>
      </ion-item>
      <ion-item v-if="urgentStatuses.length === 0">
        <ion-icon slot="start" :icon="checkmarkCircleOutline" color="success" />
        <ion-label color="success">Всё в порядке</ion-label>
      </ion-item>
    </ion-list>
    <ion-button v-if="urgentTotal > urgentStatuses.length" expand="block" fill="clear" @click="emit('viewAllMaintenance')">
      Смотреть все ({{ urgentTotal }})
    </ion-button>

    <ion-list v-if="eventsTotal > 0" inset>
      <ion-list-header>
        <ion-label>Последние события</ion-label>
        <ion-button fill="clear" size="small" @click="emit('viewAllEvents')">Все события</ion-button>
      </ion-list-header>
      <ion-item v-for="event in recentEvents" :key="`${event.kind}-${event.id}`">
        <ion-icon slot="start" :icon="eventIcon(event)" />
        <ion-label>
          <h2>{{ eventTitle(event) }}</h2>
          <p>{{ eventMeta(event) }}</p>
        </ion-label>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<style scoped>
.due-text {
  color: var(--ion-color-danger);
}

.soon-text {
  color: var(--ion-color-tertiary);
}

.stat-card {
  padding: 14px 16px;
  margin: 0;
}

.stat-headline {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.stat-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-color-medium);
}
</style>
