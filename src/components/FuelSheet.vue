<script setup lang="ts">
import { computed, ref } from 'vue'
import { haptic } from '../utils/haptics'
import ToggleSwitch from './ToggleSwitch.vue'

const props = defineProps<{
  currentMileage: number
  tankCapacity?: number
  averagePrice: number | null
  lastFuelType?: string
  lastStation?: string
  lastPrice: number | null
  lastMileage?: number
}>()

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      mileage: number
      liters: number
      cost?: number
      fuelType?: string
      isFullTank?: boolean
      remainingLiters?: number
      station?: string
      comment?: string
    },
  ]
}>()

const FUEL_TYPES = ['АИ-92', 'АИ-95', 'АИ-98', 'Дизель', 'Газ']

const mileage = ref(String(props.currentMileage))
const liters = ref('')
const cost = ref('')
const pricePerLiter = ref('')
const fuelType = ref('')
const isFullTank = ref(true)
const hasRemaining = ref(false)
const remainingLiters = ref('')
const station = ref('')
const comment = ref('')
const showMore = ref(false)
const quickEntry = ref('')

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

function applyQuickEntry() {
  if (!quickEntry.value.trim()) return
  const parsed = parseQuickEntry(quickEntry.value)
  if (parsed.mileage !== undefined) mileage.value = String(parsed.mileage)
  if (parsed.liters !== undefined) liters.value = String(parsed.liters)
  if (parsed.cost !== undefined) cost.value = String(parsed.cost)
  if (parsed.pricePerLiter !== undefined) {
    pricePerLiter.value = String(parsed.pricePerLiter)
    showMore.value = true
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
    mileageNumber.value < props.currentMileage ||
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
  if (props.lastMileage === undefined || mileage.value.trim() === '' || Number.isNaN(mileageNumber.value)) {
    return false
  }
  return mileageNumber.value === props.lastMileage
})

function selectFuelType(value: string) {
  haptic('tap')
  fuelType.value = fuelType.value === value ? '' : value
}

function toggleFullTank() {
  haptic('tap')
  isFullTank.value = !isFullTank.value
  if (isFullTank.value) hasRemaining.value = false
}

function toggleHasRemaining() {
  if (isFullTank.value) return
  haptic('tap')
  hasRemaining.value = !hasRemaining.value
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
  showMore.value = true
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
    cost: finalCost,
    fuelType: fuelType.value || undefined,
    isFullTank: isFullTank.value,
    remainingLiters: !isFullTank.value && hasRemaining.value ? remainingLitersNumber.value : undefined,
    station: station.value.trim() || undefined,
    comment: comment.value.trim() || undefined,
  })
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Отмена</button>
        <h2>Заправка</h2>
        <button class="save" :class="{ disabled: !isValid }" @click="handleSave">
          Готово
        </button>
      </div>

      <div class="form">
        <div class="quick-entry-row">
          <input
            v-model="quickEntry"
            type="text"
            class="quick-entry-input"
            placeholder="Быстрый ввод: 40л 3200р 80000км"
            aria-label="Быстрый ввод заправки"
            @keydown.enter="applyQuickEntry"
          />
          <button
            v-if="quickEntry.trim()"
            type="button"
            class="quick-entry-apply"
            aria-label="Применить"
            @click="applyQuickEntry"
          >
            ✓
          </button>
        </div>
        <button v-if="suggestionLabel" type="button" class="suggestion-chip" @click="applySuggestion">
          Как в прошлый раз: {{ suggestionLabel }}
        </button>
        <div class="group">
          <div class="field">
            <label>Пробег на заправке, км</label>
            <input v-model="mileage" type="text" inputmode="numeric" />
          </div>
          <div class="divider" />
          <div class="field">
            <label>Литры</label>
            <input v-model="liters" type="text" inputmode="decimal" placeholder="35.5" />
          </div>
          <div class="divider" />
          <div class="field">
            <label>Стоимость, ₽ (необязательно)</label>
            <input v-model="cost" type="text" inputmode="decimal" placeholder="—" />
          </div>
        </div>
        <p v-if="mileage.trim() && mileageNumber < currentMileage" class="hint">
          Пробег не может быть меньше текущего ({{ currentMileage.toLocaleString('ru-RU') }} км)
        </p>
        <p v-if="looksLikeDuplicate" class="hint warn">
          ⚠ Такой же пробег, как в прошлой заправке — не дубль ли это?
        </p>
        <p v-if="litersExceedTank" class="hint warn">
          ⚠ Больше, чем вмещает бак ({{ tankCapacity }} л) — проверьте значение
        </p>
        <p v-if="priceLooksOff" class="hint warn">
          ⚠ Цена сильно отличается от обычной (~{{ averagePrice?.toFixed(1) }} ₽/л) — проверьте значение
        </p>

        <div class="more-block">
          <button class="section-title toggleable" @click="showMore = !showMore">
            <span>Ещё</span>
            <span class="caret" :class="{ open: showMore }">›</span>
          </button>

          <div v-if="showMore" class="group">
            <div class="field">
              <label>Вид топлива</label>
              <div class="type-chips">
                <button
                  v-for="ft in FUEL_TYPES"
                  :key="ft"
                  type="button"
                  class="type-chip"
                  :class="{ active: fuelType === ft }"
                  @click="selectFuelType(ft)"
                >
                  {{ ft }}
                </button>
              </div>
            </div>
            <div class="divider" />
            <div class="field">
              <label>Цена, ₽/л (необязательно)</label>
              <input v-model="pricePerLiter" type="text" inputmode="decimal" placeholder="—" />
            </div>
            <div class="divider" />
            <div class="field switch-row">
              <span>Полный бак</span>
              <ToggleSwitch :checked="isFullTank" aria-label="Полный бак" @update:checked="toggleFullTank" />
            </div>
            <div class="divider" />
            <div class="field switch-row" :class="{ disabled: isFullTank }">
              <span>Остаток в баке</span>
              <ToggleSwitch
                :checked="hasRemaining"
                :disabled="isFullTank"
                aria-label="Остаток в баке"
                @update:checked="toggleHasRemaining"
              />
            </div>
            <template v-if="hasRemaining && !isFullTank">
              <div class="divider" />
              <div class="field">
                <label>Сколько оставалось до заправки, л</label>
                <input v-model="remainingLiters" type="text" inputmode="decimal" placeholder="5" />
              </div>
            </template>
            <div class="divider" />
            <div class="field">
              <label>АЗС (необязательно)</label>
              <input v-model="station" type="text" placeholder="Название или адрес" />
            </div>
            <div class="divider" />
            <div class="field">
              <label>Комментарий (необязательно)</label>
              <input v-model="comment" type="text" placeholder="—" />
            </div>
          </div>
          <p v-if="remainingExceedsTank" class="hint warn advanced-hint">
            ⚠ Больше, чем вмещает бак ({{ tankCapacity }} л) — проверьте значение
          </p>
          <p v-if="showMore && !isFullTank" class="hint advanced-hint">
            Точный расход считается между заправками «под пробку». Если бак не полный, отметьте
            «Остаток в баке», чтобы эта заправка тоже участвовала в расчёте
          </p>
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
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: var(--bg-grouped);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 8px 0 calc(24px + var(--safe-bottom));
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
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 4px;
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

.save {
  font-size: 17px;
  font-weight: 600;
  color: var(--blue);
}

.save.disabled {
  opacity: 0.4;
}

.form {
  padding: 12px 16px 0;
}

.group {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 0 14px;
  border: 1px solid var(--card-border);
}

.quick-entry-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  margin-bottom: 12px;
  height: 40px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
}

.quick-entry-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--text);
  outline: none;
}

.quick-entry-input::placeholder {
  color: var(--text-tertiary);
}

.quick-entry-apply {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-entry-apply:active {
  opacity: 0.7;
}

.suggestion-chip {
  display: block;
  width: 100%;
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--blue) 12%, transparent);
  color: var(--blue);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.suggestion-chip:active {
  opacity: 0.7;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 0;
}

.field label {
  font-size: 12px;
  color: var(--text-secondary);
}

.field input {
  border: none;
  background: transparent;
  font-size: 17px;
  color: var(--text);
  outline: none;
}

.field input::placeholder {
  color: var(--text-tertiary);
}

.divider {
  height: 1px;
  background: var(--separator);
}

.hint {
  font-size: 13px;
  color: var(--red);
  margin: 10px 4px 0;
}

.hint.warn {
  color: var(--orange);
}

.more-block {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0 4px;
}

.section-title.toggleable {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.caret {
  display: inline-block;
  transform: rotate(90deg);
  transition: transform 0.2s;
}

.caret.open {
  transform: rotate(270deg);
}

.advanced-hint {
  padding: 0 4px;
  color: var(--text-tertiary);
}

.type-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0 4px;
}

.type-chip {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: var(--radius-pill);
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.type-chip.active {
  background: var(--blue);
  color: #fff;
}

.type-chip:active {
  opacity: 0.7;
}

.switch-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.switch-row span:first-child {
  font-size: 17px;
  color: var(--text);
}

.switch-row.disabled span:first-child {
  color: var(--text-tertiary);
}

</style>
