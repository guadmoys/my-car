<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonToggle,
  type InputCustomEvent,
  type SegmentCustomEvent,
  type SelectCustomEvent,
  type ToggleCustomEvent,
} from '@ionic/vue'
import { eyeOutline } from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'
import {
  DATE_FORMAT_OPTIONS,
  formatDate,
  getDateFormat,
  isShowYearEnabled,
  setDateFormat,
  setShowYearEnabled,
} from '../../utils/dateFormat'
import type { DateFormatId } from '../../utils/dateFormat'
import { CURRENCY_OPTIONS, currency, setCurrency } from '../../utils/money/currency'
import { monthlyBudget, setMonthlyBudget } from '../../utils/money/budget'
import { THEME_OPTIONS, getThemeMode, setThemeMode, type ThemeMode } from '../../utils/theme'

const dateFormat = ref<DateFormatId>(getDateFormat())
const showYear = ref(isShowYearEnabled())
const datePreview = computed(() => formatDate(Date.now()))
const dateFormatHint = computed(
  () => `«Авто» использует формат вашего региона. Пример: ${datePreview.value}. Применяется к датам заправок`,
)

function selectDateFormat(event: SegmentCustomEvent) {
  const value = event.detail.value as DateFormatId
  dateFormat.value = value
  setDateFormat(value)
}

const themeMode = ref<ThemeMode>(getThemeMode())

function selectTheme(event: SegmentCustomEvent) {
  const value = event.detail.value as ThemeMode
  themeMode.value = value
  setThemeMode(value)
}

function selectCurrency(event: SelectCustomEvent) {
  setCurrency(event.detail.value as string)
}

function handleToggleShowYear(checked: boolean) {
  showYear.value = checked
  setShowYearEnabled(checked)
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>
      <ion-label>Оформление</ion-label>
    </ion-list-header>
    <ion-item>
      <ion-segment :value="themeMode" aria-label="Тема оформления" @ionChange="selectTheme">
        <ion-segment-button v-for="opt in THEME_OPTIONS" :key="opt.value" :value="opt.value">
          <ion-label>{{ opt.label }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-item>
    <ion-item lines="none">
      <ion-select label="Валюта" :value="currency" interface="action-sheet" :interface-options="{ cancelText: 'Отмена' }" @ionChange="selectCurrency">
        <ion-select-option v-for="c in CURRENCY_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</ion-select-option>
      </ion-select>
    </ion-item>
  </ion-list>

  <ion-list inset>
    <ion-list-header>Бюджет</ion-list-header>
    <ion-item lines="none">
      <ion-input
        :value="monthlyBudget ?? ''"
        :label="`Бюджет на месяц, ${currency}`"
        label-placement="stacked"
        inputmode="numeric"
        enterkeyhint="done"
        placeholder="Не задан"
        @ion-change="(e: InputCustomEvent) => setMonthlyBudget(Number(String(e.detail.value ?? '').replace(/\s/g, '').replace(',', '.')) || null)"
      />
    </ion-item>
  </ion-list>

  <ion-list inset>
    <ion-list-header>
      <ion-label>Формат даты</ion-label>
      <HintButton :text="dateFormatHint" />
    </ion-list-header>
    <ion-item>
      <ion-segment :value="dateFormat" @ionChange="selectDateFormat">
        <ion-segment-button v-for="opt in DATE_FORMAT_OPTIONS" :key="opt.value" :value="opt.value">
          <ion-label>{{ opt.label }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-item>
    <ion-item lines="none">
      <SettingsIconBadge slot="start" :icon="eyeOutline" color="secondary" />
      <ion-toggle justify="space-between" :checked="showYear" @ion-change="(e: ToggleCustomEvent) => handleToggleShowYear(e.detail.checked)">
        Показывать год
      </ion-toggle>
    </ion-item>
  </ion-list>
</template>
