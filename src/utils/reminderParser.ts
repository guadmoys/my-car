/**
 * Parses a one-line reminder shorthand into its trigger and text, so adding a
 * reminder is a single free-text field instead of separate mode/date/km
 * inputs. Supported forms:
 *   - "через 300 км проверить масло"        → relative mileage
 *   - "22.01.2026 проверить масло"           → calendar date (default 09:00)
 *   - "22.01.2026 12:30 запись в сервис"     → date + specific time
 */
export interface ParsedReminder {
  text: string
  relativeKm?: number
  dueDate?: number
  hasTime: boolean
}

const DEFAULT_HOUR = 9

const KM_RE = /^через\s+(\d+)\s*км\.?\s+(.+)$/i
const DATE_TIME_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})\s+(.+)$/
const DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(.+)$/

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

export function parseReminderInput(raw: string): ParsedReminder | null {
  const input = raw.trim()
  if (!input) return null

  const kmMatch = input.match(KM_RE)
  if (kmMatch) {
    const km = parseInt(kmMatch[1], 10)
    const text = kmMatch[2].trim()
    if (km > 0 && text) return { text, relativeKm: km, hasTime: false }
  }

  const dateTimeMatch = input.match(DATE_TIME_RE)
  if (dateTimeMatch) {
    const [, d, mo, y, h, mi, text] = dateTimeMatch
    const day = Number(d)
    const month = Number(mo)
    const year = Number(y)
    const hour = Number(h)
    const minute = Number(mi)
    if (
      isValidCalendarDate(day, month, year) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59 &&
      text.trim()
    ) {
      return {
        text: text.trim(),
        dueDate: new Date(year, month - 1, day, hour, minute).getTime(),
        hasTime: true,
      }
    }
  }

  const dateMatch = input.match(DATE_RE)
  if (dateMatch) {
    const [, d, mo, y, text] = dateMatch
    const day = Number(d)
    const month = Number(mo)
    const year = Number(y)
    if (isValidCalendarDate(day, month, year) && text.trim()) {
      return {
        text: text.trim(),
        dueDate: new Date(year, month - 1, day, DEFAULT_HOUR, 0).getTime(),
        hasTime: false,
      }
    }
  }

  return null
}
