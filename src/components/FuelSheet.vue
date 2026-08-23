<script setup lang="ts">
import { computed, ref } from 'vue'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  currentMileage: number
  tankCapacity?: number
  averagePrice: number | null
  lastFuelType?: string
  lastStation?: string
  lastPrice: number | null
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
            <label class="field switch-row">
              <span>Полный бак</span>
              <span class="switch">
                <input type="checkbox" :checked="isFullTank" @change="toggleFullTank" />
                <span class="slider" />
              </span>
            </label>
            <div class="divider" />
            <label class="field switch-row" :class="{ disabled: isFullTank }">
              <span>Остаток в баке</span>
              <span class="switch">
                <input type="checkbox" :checked="hasRemaining" :disabled="isFullTank" @change="toggleHasRemaining" />
                <span class="slider" />
              </span>
            </label>
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
  animation: slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1);
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

.switch input:disabled + .slider {
  opacity: 0.4;
}
</style>
