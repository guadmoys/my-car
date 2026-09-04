<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToggle,
  IonToolbar,
  type ToggleCustomEvent,
} from '@ionic/vue'
import { checkmark } from 'ionicons/icons'
import { haptic } from '../utils/haptics'
import { mileageInputSeed } from '../utils/mileage'
import type { FuelEntry } from '../types'
import ReceiptPhotoField from './ReceiptPhotoField.vue'

const props = defineProps<{
  currentMileage: number
  tankCapacity?: number
  averagePrice: number | null
  lastFuelType?: string
  lastStation?: string
  lastPrice: number | null
  lastMileage?: number
  /** When set, the sheet edits this existing entry instead of creating a new one. */
  entry?: FuelEntry
}>()

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      mileage: number
      liters: number
      date?: number
      cost?: number
      fuelType?: string
      isFullTank?: boolean
      remainingLiters?: number
      station?: string
      comment?: string
      receiptPhoto?: string
    },
  ]
}>()

const FUEL_TYPES = ['АИ-92', 'АИ-95', 'АИ-98', 'Дизель', 'Газ']

const isEditing = computed(() => props.entry !== undefined)

const mileage = ref(props.entry ? String(props.entry.mileage) : mileageInputSeed(props.currentMileage))
// The seeded value is deliberately below currentMileage (only the trailing
// digits are missing) — don't flag it as "too low" until the user actually
// types something. An existing entry's mileage is real, so flag it immediately.
const mileageTouched = ref(isEditing.value)
const liters = ref(props.entry ? String(props.entry.liters) : '')
const cost = ref(props.entry?.cost !== undefined ? String(props.entry.cost) : '')
const pricePerLiter = ref('')
const fuelType = ref(props.entry?.fuelType ?? props.lastFuelType ?? '')
const isFullTank = ref(props.entry?.isFullTank ?? true)
const hasRemaining = ref(props.entry?.remainingLiters !== undefined)
const remainingLiters = ref(props.entry?.remainingLiters !== undefined ? String(props.entry.remainingLiters) : '')
const station = ref(props.entry?.station ?? '')
const comment = ref(props.entry?.comment ?? '')
const receiptPhoto = ref<string | undefined>(props.entry?.receiptPhoto)
const quickEntry = ref('')
const dateIso = ref(new Date(props.entry?.date ?? Date.now()).toISOString())

// Parses a free-form line like "40л 3200р 80000км" into individual fields,
// so a fill-up can be logged in one shot instead of tabbing through inputs.
// Each unit is matched and stripped from a working copy in turn, so e.g.
// "55р/л" (price per liter) can't also be picked up by the plain-cost match.
function parseQuickEntry(raw: string): {
  mileage?: number
  liters?: number
  cost?: number
  pricePerLiter?: number
} {
  let text = raw.toLowerCase()
  const take = (re: RegExp): number | undefined => {
    const m = text.match(re)
    if (!m) return undefined
    text = text.slice(0, m.index) + text.slice(m.index! + m[0].length)
    return Number(m[1].replace(',', '.'))
  }
  // No \b here: JS's \b is defined via \w, which is ASCII-only and never
  // matches around Cyrillic letters — it would silently fail to anchor
  // after "л"/"р". The digit-adjacency requirement already keeps these
  // from matching inside unrelated words, so a boundary isn't needed.
  return {
    pricePerLiter: take(/(\d+(?:[.,]\d+)?)\s*(?:₽\s*\/\s*л|руб\s*\/\s*л|р\s*\/\s*л)/),
    mileage: take(/(\d+(?:[.,]\d+)?)\s*км/),
    liters: take(/(\d+(?:[.,]\d+)?)\s*л/),
    cost: take(/(\d+(?:[.,]\d+)?)\s*(?:₽|руб|р)/),
  }
}

// Pre-opened when there's a last fuel type to show (or an existing entry has
// any of these fields set), so the pre-filled selection is visible without an
// extra tap on "Ещё".
const accordionValue = ref<string | undefined>(
  props.lastFuelType || props.entry?.fuelType || props.entry?.station || props.entry?.comment ? 'more' : undefined,
)

function applyQuickEntry() {
  if (!quickEntry.value.trim()) return
  const parsed = parseQuickEntry(quickEntry.value)
  if (parsed.mileage !== undefined) {
    mileage.value = String(parsed.mileage)
    mileageTouched.value = true
  }
  if (parsed.liters !== undefined) liters.value = String(parsed.liters)
  if (parsed.cost !== undefined) cost.value = String(parsed.cost)
  if (parsed.pricePerLiter !== undefined) {
    pricePerLiter.value = String(parsed.pricePerLiter)
    accordionValue.value = 'more'
  }
  if (Object.values(parsed).some((v) => v !== undefined)) {
    haptic('success')
    quickEntry.value = ''
  } else {
    haptic('warning')
  }
}

const mileageNumber = computed(() => Number(mileage.value.replace(/\s/g, '').replace(',', '.')))
const litersNumber = computed(() => Number(liters.value.replace(/\s/g, '').replace(',', '.')))
const costNumber = computed(() => Number(cost.value.replace(/\s/g, '').replace(',', '.')))
const priceNumber = computed(() => Number(pricePerLiter.value.replace(/\s/g, '').replace(',', '.')))
const remainingLitersNumber = computed(() => Number(remainingLiters.value.replace(/\s/g, '').replace(',', '.')))

const isValid = computed(() => {
  if (
    mileage.value.trim().length === 0 ||
    Number.isNaN(mileageNumber.value) ||
    (isEditing.value ? mileageNumber.value <= 0 : mileageNumber.value < props.currentMileage) ||
    liters.value.trim().length === 0 ||
    Number.isNaN(litersNumber.value) ||
    litersNumber.value <= 0
  ) {
    return false
  }
  if (cost.value.trim() !== '' && (Number.isNaN(costNumber.value) || costNumber.value < 0)) return false
  if (pricePerLiter.value.trim() !== '' && (Number.isNaN(priceNumber.value) || priceNumber.value < 0)) return false
  if (
    hasRemaining.value &&
    (remainingLiters.value.trim() === '' || Number.isNaN(remainingLitersNumber.value) || remainingLitersNumber.value < 0)
  ) {
    return false
  }
  return true
})

// Non-blocking sanity checks: catch likely typos without stopping the save.
const litersExceedTank = computed(() => {
  if (props.tankCapacity === undefined || liters.value.trim() === '' || Number.isNaN(litersNumber.value)) {
    return false
  }
  return litersNumber.value > props.tankCapacity
})

const remainingExceedsTank = computed(() => {
  if (
    props.tankCapacity === undefined ||
    isFullTank.value ||
    !hasRemaining.value ||
    remainingLiters.value.trim() === '' ||
    Number.isNaN(remainingLitersNumber.value)
  ) {
    return false
  }
  return remainingLitersNumber.value > props.tankCapacity
})

const effectivePrice = computed<number | null>(() => {
  if (pricePerLiter.value.trim() !== '' && !Number.isNaN(priceNumber.value) && priceNumber.value > 0) {
    return priceNumber.value
  }
  if (
    cost.value.trim() !== '' &&
    !Number.isNaN(costNumber.value) &&
    liters.value.trim() !== '' &&
    !Number.isNaN(litersNumber.value) &&
    litersNumber.value > 0
  ) {
    return costNumber.value / litersNumber.value
  }
  return null
})

const priceLooksOff = computed(() => {
  if (props.averagePrice === null || props.averagePrice <= 0 || effectivePrice.value === null) return false
  return Math.abs(effectivePrice.value - props.averagePrice) / props.averagePrice >= 0.4
})

// Odometer readings only ever go up, so an exact match with the previous
// fill-up's mileage is a strong, low-noise signal of an accidental
// double-submit or a stale mileage typo — not a coincidence.
const looksLikeDuplicate = computed(() => {
  if (isEditing.value || props.lastMileage === undefined || mileage.value.trim() === '' || Number.isNaN(mileageNumber.value)) {
    return false
  }
  return mileageNumber.value === props.lastMileage
})

function selectFuelType(value: string) {
  haptic('tap')
  fuelType.value = fuelType.value === value ? '' : value
}

function toggleFullTank(checked: boolean) {
  haptic('tap')
  isFullTank.value = checked
  if (isFullTank.value) hasRemaining.value = false
}

function toggleHasRemaining(checked: boolean) {
  if (isFullTank.value) return
  haptic('tap')
  hasRemaining.value = checked
}

const suggestionLabel = computed(() => {
  const parts: string[] = []
  if (props.lastFuelType) parts.push(props.lastFuelType)
  if (props.lastStation) parts.push(props.lastStation)
  if (props.lastPrice !== null) parts.push(`${props.lastPrice.toFixed(1)} ₽/л`)
  return parts.join(' · ')
})

function applySuggestion() {
  if (!suggestionLabel.value) return
  haptic('tap')
  if (props.lastFuelType) fuelType.value = props.lastFuelType
  if (props.lastStation) station.value = props.lastStation
  if (props.lastPrice !== null) pricePerLiter.value = props.lastPrice.toFixed(2)
  accordionValue.value = 'more'
}

function handleSave() {
  if (!isValid.value) return

  let finalCost: number | undefined
  if (cost.value.trim() !== '') {
    finalCost = costNumber.value
  } else if (pricePerLiter.value.trim() !== '') {
    finalCost = Math.round(litersNumber.value * priceNumber.value * 100) / 100
  }

  emit('save', {
    mileage: Math.round(mileageNumber.value),
    liters: litersNumber.value,
    date: isEditing.value ? new Date(dateIso.value).getTime() : undefined,
    cost: finalCost,
    fuelType: fuelType.value || undefined,
    isFullTank: isFullTank.value,
    remainingLiters: !isFullTank.value && hasRemaining.value ? remainingLitersNumber.value : undefined,
    station: station.value.trim() || undefined,
    comment: comment.value.trim() || undefined,
    receiptPhoto: receiptPhoto.value,
  })
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>{{ isEditing ? 'Изменить заправку' : 'Заправка' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list v-if="!isEditing" inset>
        <ion-item lines="none">
          <ion-input
            v-model="quickEntry"
            label="Быстрый ввод"
            label-placement="stacked"
            placeholder="40л 3200р 80000км"
            aria-label="Быстрый ввод заправки"
            @keydown.enter="applyQuickEntry"
          >
            <ion-button v-if="quickEntry.trim()" slot="end" fill="clear" aria-label="Применить" @click="applyQuickEntry">
              <ion-icon slot="icon-only" :icon="checkmark" />
            </ion-button>
          </ion-input>
        </ion-item>
      </ion-list>

      <div v-if="!isEditing && suggestionLabel" class="ion-padding-horizontal">
        <ion-chip color="primary" outline @click="applySuggestion">
          Как в прошлый раз: {{ suggestionLabel }}
        </ion-chip>
      </div>

      <ion-list v-if="isEditing" inset>
        <ion-item lines="none">
          <ion-label>Дата</ion-label>
          <ion-datetime-button slot="end" datetime="fuel-entry-date" />
        </ion-item>
      </ion-list>
      <ion-modal v-if="isEditing" :keep-contents-mounted="true">
        <ion-datetime id="fuel-entry-date" v-model="dateIso" presentation="date" locale="ru-RU" />
      </ion-modal>

      <ion-list inset>
        <ion-item>
          <ion-input
            v-model="mileage"
            label="Пробег на заправке, км"
            label-placement="stacked"
            inputmode="numeric"
            @ion-input="mileageTouched = true"
          />
        </ion-item>
        <ion-item>
          <ion-input v-model="liters" label="Литры" label-placement="stacked" inputmode="decimal" placeholder="35.5" />
        </ion-item>
        <ion-item lines="none">
          <ion-input v-model="cost" label="Стоимость, ₽ (необязательно)" label-placement="stacked" inputmode="decimal" placeholder="—" />
        </ion-item>
      </ion-list>
      <ion-note v-if="!isEditing && mileageTouched && mileage.trim() && mileageNumber < currentMileage" color="danger" class="hint">
        Пробег не может быть меньше текущего ({{ currentMileage.toLocaleString('ru-RU') }} км)
      </ion-note>
      <ion-note v-if="mileageTouched && looksLikeDuplicate" color="warning" class="hint">
        ⚠ Такой же пробег, как в прошлой заправке — не дубль ли это?
      </ion-note>
      <ion-note v-if="litersExceedTank" color="warning" class="hint">
        ⚠ Больше, чем вмещает бак ({{ tankCapacity }} л) — проверьте значение
      </ion-note>
      <ion-note v-if="priceLooksOff" color="warning" class="hint">
        ⚠ Цена сильно отличается от обычной (~{{ averagePrice?.toFixed(1) }} ₽/л) — проверьте значение
      </ion-note>

      <ion-accordion-group v-model="accordionValue">
        <ion-accordion value="more">
          <ion-item slot="header">
            <ion-label>Ещё</ion-label>
          </ion-item>
          <ion-list slot="content" inset>
            <ion-item lines="full">
              <ion-label class="ion-text-wrap">
                <p>Вид топлива</p>
                <div class="type-chips">
                  <ion-chip
                    v-for="ft in FUEL_TYPES"
                    :key="ft"
                    :color="fuelType === ft ? 'primary' : undefined"
                    :outline="fuelType !== ft"
                    @click="selectFuelType(ft)"
                  >
                    {{ ft }}
                  </ion-chip>
                </div>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-input v-model="pricePerLiter" label="Цена, ₽/л (необязательно)" label-placement="stacked" inputmode="decimal" placeholder="—" />
            </ion-item>
            <ion-item>
              <ion-toggle :checked="isFullTank" @ion-change="(e: ToggleCustomEvent) => toggleFullTank(e.detail.checked)">Полный бак</ion-toggle>
            </ion-item>
            <ion-item>
              <ion-toggle :checked="hasRemaining" :disabled="isFullTank" @ion-change="(e: ToggleCustomEvent) => toggleHasRemaining(e.detail.checked)">
                Остаток в баке
              </ion-toggle>
            </ion-item>
            <ion-item v-if="hasRemaining && !isFullTank">
              <ion-input v-model="remainingLiters" label="Сколько оставалось до заправки, л" label-placement="stacked" inputmode="decimal" placeholder="5" />
            </ion-item>
            <ion-item>
              <ion-input v-model="station" label="АЗС (необязательно)" label-placement="stacked" placeholder="Название или адрес" />
            </ion-item>
            <ion-item lines="none">
              <ion-input v-model="comment" label="Комментарий (необязательно)" label-placement="stacked" placeholder="—" />
            </ion-item>
          </ion-list>
          <ReceiptPhotoField slot="content" v-model="receiptPhoto" />
          <ion-note v-if="remainingExceedsTank" slot="content" color="warning" class="hint">
            ⚠ Больше, чем вмещает бак ({{ tankCapacity }} л) — проверьте значение
          </ion-note>
          <ion-note v-if="!isFullTank" slot="content" color="medium" class="hint">
            Точный расход считается между заправками «под пробку». Если бак не полный, отметьте
            «Остаток в баке», чтобы эта заправка тоже участвовала в расчёте
          </ion-note>
        </ion-accordion>
      </ion-accordion-group>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint {
  display: block;
  font-size: 13px;
  margin: 8px 32px;
}

.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
</style>
