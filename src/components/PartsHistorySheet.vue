<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { EXPENSE_ITEM_KIND_LABELS, type ExpenseItemKind } from '../types'
import { formatMoney } from '../utils/currency'
import { monthLabel } from '../utils/monthLabel'
import type { PartRow } from '../utils/partsList'

const props = defineProps<{
  rows: PartRow[]
  masterName: (id: string) => string | undefined
}>()

const emit = defineEmits<{
  close: []
}>()

const kind = ref<'all' | ExpenseItemKind>('all')
const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.rows.filter((r) => {
    if (kind.value !== 'all' && r.item.kind !== kind.value) return false
    if (!q) return true
    return [r.item.name, r.source, r.masterId ? props.masterName(r.masterId) : ''].join(' ').toLowerCase().includes(q)
  })
})

const total = computed(() => filtered.value.reduce((s, r) => s + r.item.amount, 0))

interface Month {
  key: string
  label: string
  rows: PartRow[]
}

const months = computed<Month[]>(() => {
  const result: Month[] = []
  for (const r of filtered.value) {
    const d = new Date(r.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let m = result[result.length - 1]
    if (!m || m.key !== key) {
      m = { key, label: monthLabel(r.date), rows: [] }
      result.push(m)
    }
    m.rows.push(r)
  }
  return result
})

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Детали и работы</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="kind">
          <ion-segment-button value="all"><ion-label>Все</ion-label></ion-segment-button>
          <ion-segment-button value="part"><ion-label>Детали</ion-label></ion-segment-button>
          <ion-segment-button value="labor"><ion-label>Работы</ion-label></ion-segment-button>
          <ion-segment-button value="other"><ion-label>Другое</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="query" placeholder="Поиск: колодки, покраска, мастер" :debounce="200" />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list v-if="rows.length > 0" inset>
        <ion-item lines="none">
          <ion-label><strong>Итого</strong> · {{ filtered.length }} шт.</ion-label>
          <ion-note slot="end" color="primary"><strong>{{ formatMoney(total) }}</strong></ion-note>
        </ion-item>
      </ion-list>

      <ion-list v-for="m in months" :key="m.key" inset>
        <ion-list-header>
          <ion-label>{{ m.label }}</ion-label>
        </ion-list-header>
        <ion-item v-for="r in m.rows" :key="r.key">
          <ion-label class="ion-text-wrap">
            <h2>{{ r.item.name || EXPENSE_ITEM_KIND_LABELS[r.item.kind] }}</h2>
            <p>
              {{ EXPENSE_ITEM_KIND_LABELS[r.item.kind] }} · {{ fmtDate(r.date) }} · {{ r.source }}<template
                v-if="r.masterId && masterName(r.masterId)"
              > · {{ masterName(r.masterId) }}</template><template v-if="r.item.warrantyMonths"> · гарантия {{ r.item.warrantyMonths }} мес.</template>
            </p>
          </ion-label>
          <ion-note slot="end">{{ formatMoney(r.item.amount) }}</ion-note>
        </ion-item>
      </ion-list>

      <ion-list v-if="months.length === 0" inset>
        <ion-item lines="none">
          <ion-label color="medium" class="ion-text-wrap">
            {{ rows.length === 0 ? 'Пока нет записей. Состав указывается в расходе или ТО: «Из чего состоит сумма»' : 'Ничего не найдено — измените запрос или фильтр' }}
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
