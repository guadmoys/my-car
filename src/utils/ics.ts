/** The .ics text for a one-day all-day reminder with a day-before alarm. */
export function buildIcsReminder(opts: { title: string; description?: string; dueAt: number }, now = new Date()): string {
  const due = new Date(opts.dueAt)
  const dateStr = formatIcsDate(due)
  // Next calendar day by date arithmetic: adding 24h lands on the same date on a 25-hour DST day.
  const dateEndStr = formatIcsDate(new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1))
  const stamp = formatIcsDateTime(now)
  const uid = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}@moya-mashina`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Моя машина//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateEndStr}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    opts.description ? `DESCRIPTION:${escapeIcs(opts.description)}` : null,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Напоминание о ТО',
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => line !== null)

  return lines.join('\r\n')
}

export function downloadIcsReminder(opts: { title: string; description?: string; dueAt: number }): void {
  const blob = new Blob([buildIcsReminder(opts)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'napominanie-to.ics'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatIcsDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function formatIcsDateTime(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

function escapeIcs(text: string): string {
  return text.replace(/([\\,;])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

export interface CalendarEvent {
  uid: string
  title: string
  description?: string
  /** Start, as a timestamp; written as local ("floating") time so it rings at that wall-clock time wherever you are. */
  start: number
}

function formatIcsLocal(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

/** Folds a content line to 75 characters, as RFC 5545 asks, so strict calendars accept long Russian titles. */
function foldIcsLine(line: string): string {
  const parts: string[] = []
  let rest = line
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73))
    rest = ` ${rest.slice(73)}`
  }
  parts.push(rest)
  return parts.join('\r\n')
}

/** A calendar file with one timed event (and an alarm at its start) per upcoming deadline. */
export function buildIcsCalendar(events: CalendarEvent[], now = new Date()): string {
  const stamp = formatIcsDateTime(now)
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Моя машина//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Моя машина']
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@moya-mashina`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsLocal(e.start)}`,
      `DTEND:${formatIcsLocal(e.start + 30 * 60 * 1000)}`,
      `SUMMARY:${escapeIcs(e.title)}`,
    )
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`)
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(e.title)}`, 'TRIGGER:PT0S', 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n')
}

export function downloadIcsCalendar(events: CalendarEvent[], fileName = 'moya-mashina-sroki.ics'): void {
  const blob = new Blob([buildIcsCalendar(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
