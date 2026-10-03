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

// These run at import time, so blocked storage (private mode, strict browser
// settings) must fall back to defaults instead of crashing the whole app.
function loadFormat(): DateFormatId {
  try {
    const stored = localStorage.getItem(FORMAT_KEY)
    return DATE_FORMAT_OPTIONS.some((o) => o.value === stored) ? (stored as DateFormatId) : 'auto'
  } catch {
    return 'auto'
  }
}

function loadShowYear(): boolean {
  try {
    return localStorage.getItem(SHOW_YEAR_KEY) === 'true'
  } catch {
    return false
  }
}

const dateFormat = ref<DateFormatId>(loadFormat())
const showYear = ref<boolean>(loadShowYear())

export function getDateFormat(): DateFormatId {
  return dateFormat.value
}

export function setDateFormat(value: DateFormatId): void {
  dateFormat.value = value
  try {
    localStorage.setItem(FORMAT_KEY, value)
  } catch {
    /* best effort */
  }
}

export function isShowYearEnabled(): boolean {
  return showYear.value
}

export function setShowYearEnabled(enabled: boolean): void {
  showYear.value = enabled
  try {
    localStorage.setItem(SHOW_YEAR_KEY, enabled ? 'true' : 'false')
  } catch {
    /* best effort */
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formats a date per the user's date-format setting (default: the browser's own region format). */
export function formatDate(ts: number): string {
  const d = new Date(ts)

  if (dateFormat.value === 'auto') {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'numeric',
      year: showYear.value ? 'numeric' : undefined,
    }
    // navigator.language isn't guaranteed to be a well-formed BCP-47 tag on
    // every platform (some Linux/embedded WebViews report POSIX-style locale
    // variants like "en-US@posix") — Intl.DateTimeFormat throws a RangeError
    // on those instead of just ignoring them, and letting that escape here
    // takes down the whole render tree, not just this date. Fall back to the
    // app's own default locale rather than trusting the platform blindly.
    try {
      return new Intl.DateTimeFormat(navigator.language, options).format(d)
    } catch {
      return new Intl.DateTimeFormat('ru-RU', options).format(d)
    }
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
