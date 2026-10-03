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
