import { ref } from 'vue'

export interface CurrencyOption {
  /** Symbol shown next to amounts. */
  value: string
  label: string
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: '₽', label: '₽ рубль' },
  { value: '₴', label: '₴ гривна' },
  { value: '₸', label: '₸ тенге' },
  { value: 'Br', label: 'Br белорусский рубль' },
  { value: '$', label: '$ доллар' },
  { value: '€', label: '€ евро' },
]

const STORAGE_KEY = 'my-car-currency'

function load(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return CURRENCY_OPTIONS.some((o) => o.value === stored) ? (stored as string) : '₽'
  } catch {
    return '₽'
  }
}

/** Reactive, so templates reading `currency.value` re-render when the user changes it. */
export const currency = ref<string>(load())

export function setCurrency(symbol: string): void {
  currency.value = symbol
  try {
    localStorage.setItem(STORAGE_KEY, symbol)
  } catch {
    /* best effort */
  }
}

/** Whole-number money, e.g. "12 500 ₽". */
export function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ${currency.value}`
}

/** Price per unit with one decimal, e.g. "54.3 ₽/л". */
export function formatPricePerLiter(n: number): string {
  return `${n.toFixed(1)} ${currency.value}/л`
}
