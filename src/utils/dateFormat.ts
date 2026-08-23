import { ref } from 'vue'

export type DateFormatId = 'auto' | 'dmy' | 'mdy' | 'ymd'

export interface DateFormatOption {
  value: DateFormatId
  label: string
}

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  { value: 'auto', label: 'Авто' },
  { value: 'dmy', label: 'ДД.ММ.ГГГГ' },
  { value: 'mdy', label: 'ММ/ДД/ГГГГ' },
  { value: 'ymd', label: 'ГГГГ-ММ-ДД' },
]

const FORMAT_KEY = 'my-car-date-format'
const SHOW_YEAR_KEY = 'my-car-date-show-year'

function loadFormat(): DateFormatId {
  const stored = localStorage.getItem(FORMAT_KEY)
  return DATE_FORMAT_OPTIONS.some((o) => o.value === stored) ? (stored as DateFormatId) : 'auto'
}

function loadShowYear(): boolean {
  return localStorage.getItem(SHOW_YEAR_KEY) === 'true'
}

const dateFormat = ref<DateFormatId>(loadFormat())
const showYear = ref<boolean>(loadShowYear())

export function getDateFormat(): DateFormatId {
  return dateFormat.value
}

export function setDateFormat(value: DateFormatId): void {
  dateFormat.value = value
  localStorage.setItem(FORMAT_KEY, value)
}

export function isShowYearEnabled(): boolean {
  return showYear.value
}

export function setShowYearEnabled(enabled: boolean): void {
  showYear.value = enabled
  localStorage.setItem(SHOW_YEAR_KEY, enabled ? 'true' : 'false')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formats a date per the user's date-format setting (default: the browser's own region format). */
export function formatDate(ts: number): string {
  const d = new Date(ts)

  if (dateFormat.value === 'auto') {
    return new Intl.DateTimeFormat(navigator.language, {
      day: 'numeric',
      month: 'numeric',
      year: showYear.value ? 'numeric' : undefined,
    }).format(d)
  }

  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = String(d.getFullYear())

  switch (dateFormat.value) {
    case 'mdy':
      return showYear.value ? `${month}/${day}/${year}` : `${month}/${day}`
    case 'ymd':
      return showYear.value ? `${year}-${month}-${day}` : `${month}-${day}`
    case 'dmy':
    default:
      return showYear.value ? `${day}.${month}.${year}` : `${day}.${month}`
  }
}
