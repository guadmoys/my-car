import { DOCUMENT_TYPE_LABELS } from '../../types'
import type { Car, CarDocument, Expense, FuelEntry, HistoryEntry, MaintenanceItem, Reminder } from '../../types'
import { DAY_MS } from '../dates'
import { averageDailyKm, maintenanceStatus } from '../maintenance'
import { DOCUMENT_SOON_DAYS } from '../documents'
import { buildWarranties } from '../money/warranty'

/** Everything about one car that can raise an alert. */
export interface CarBundle {
  car: Car
  items: MaintenanceItem[]
  history: HistoryEntry[]
  fuel: FuelEntry[]
  reminders: Reminder[]
  documents: CarDocument[]
  expenses: Expense[]
}

export type AlertKind = 'service' | 'reminder' | 'document' | 'warranty'

export interface Alert {
  /**
   * Stable identity of this alert, so it is delivered once. It includes what
   * "resets" it (the last service, the document's expiry date), which is why
   * servicing or renewing something makes the next one fresh without any
   * manual clean-up.
   */
  key: string
  carId: string
  kind: AlertKind
  stage: 'soon' | 'due'
  /** When it starts to apply. At or before "now" means it applies already. */
  at: number
  title: string
  body: string
  /** True when it rests on a guess (driving pace), not a fixed date. */
  approximate: boolean
}

/** One notification to show: the alerts of one car that fall at the same moment, merged. */
export interface Note {
  key: string
  carId: string
  at: number
  title: string
  body: string
  memberKeys: string[]
}

/** Date-driven alerts fire at 9 in the morning rather than at an arbitrary time of day. */
export const ALERT_HOUR = 9

export function atMorning(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), ALERT_HOUR, 0, 0, 0).getTime()
}

function carLabel(car: Car): string {
  return `${car.make} ${car.model}`.trim()
}

function daysWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

function inDays(n: number): string {
  if (n <= 0) return 'сегодня'
  if (n === 1) return 'завтра'
  return `через ${n} ${daysWord(n)}`
}

function fmtKm(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function serviceAlerts(b: CarBundle, now: number, multi: boolean): Alert[] {
  const out: Alert[] = []
  const dailyKm = averageDailyKm(b.fuel)
  const prefix = multi ? `${carLabel(b.car)}: ` : ''

  for (const item of b.items) {
    const hist = b.history.filter((h) => h.itemId === item.id)
    const s = maintenanceStatus(item, b.car.currentMileage, now, dailyKm, hist)
    const base = `s:${item.id}:${item.lastServiceMileage}:${item.lastServiceDate ?? 0}`
    const title = `${prefix}${item.name}`
    const push = (stage: 'soon' | 'due', at: number, body: string, approximate = false) =>
      out.push({ key: `${base}:${stage}`, carId: b.car.id, kind: 'service', stage, at, title, body, approximate })

    if (s.state === 'due') {
      const overdue =
        s.remainingKm < 0
          ? `Просрочено на ${fmtKm(-s.remainingKm)} км`
          : s.remainingDays !== undefined && s.remainingDays <= 0
            ? 'Срок ТО наступил'
            : 'Пора на ТО'
      push('due', Math.min(now, s.dueAtDate !== undefined ? atMorning(s.dueAtDate) : now), overdue)
    } else if (s.state === 'soon') {
      const parts: string[] = []
      if (s.remainingKm > 0) parts.push(`осталось ~${fmtKm(s.remainingKm)} км`)
      if (s.remainingDays !== undefined && s.remainingDays > 0) parts.push(`${s.remainingDays} ${daysWord(s.remainingDays)}`)
      push('soon', now, `Скоро ТО: ${parts.join(' или ')}`)
    }

    // What is still ahead, for the schedule: date-driven, or estimated from the driving pace.
    if (s.state !== 'due') {
      if (s.dueAtDate !== undefined && s.daySoonThreshold !== null) {
        const soonAt = atMorning(s.dueAtDate - s.daySoonThreshold * DAY_MS)
        if (s.state === 'ok' && soonAt > now) push('soon', soonAt, `Скоро ТО: ${inDays(Math.round(s.daySoonThreshold))}`)
        const dueAt = atMorning(s.dueAtDate)
        if (dueAt > now) push('due', dueAt, 'Срок ТО наступил')
      } else if (s.estimatedDueDate !== undefined && dailyKm) {
        const soonKm = Math.max(0, s.remainingKm - s.kmSoonThreshold)
        const soonAt = atMorning(now + (soonKm / dailyKm) * DAY_MS)
        if (s.state === 'ok' && soonAt > now) push('soon', soonAt, 'Скоро пора на ТО — по вашему темпу езды, ориентировочно', true)
        const dueAt = atMorning(s.estimatedDueDate)
        if (dueAt > now) push('due', dueAt, 'По темпу езды пора на ТО — проверьте пробег', true)
      }
    }
  }
  return out
}

function reminderAlerts(b: CarBundle, now: number, multi: boolean): Alert[] {
  const prefix = multi ? `${carLabel(b.car)}: ` : ''
  const out: Alert[] = []
  for (const r of b.reminders) {
    const byKm = r.dueMileage !== undefined && b.car.currentMileage >= r.dueMileage
    const byDate = r.dueDate !== undefined
    if (!byKm && !byDate) continue
    // A date reminder with a clock time keeps it; one without fires in the morning.
    const dateAt = byDate ? (r.hasTime ? r.dueDate! : atMorning(r.dueDate!)) : now
    const at = byKm && (!byDate || dateAt > now) ? now : dateAt
    out.push({
      key: `r:${r.id}:due`,
      carId: b.car.id,
      kind: 'reminder',
      stage: 'due',
      at,
      title: `${prefix}Напоминание`,
      body: r.text,
      approximate: false,
    })
  }
  return out
}

function documentAlerts(b: CarBundle, now: number, multi: boolean): Alert[] {
  const prefix = multi ? `${carLabel(b.car)}: ` : ''
  const out: Alert[] = []
  for (const d of b.documents) {
    if (d.expiryDate === undefined) continue
    const name = d.title || DOCUMENT_TYPE_LABELS[d.type]
    const base = `d:${d.id}:${d.expiryDate}`
    const soonAt = atMorning(d.expiryDate - DOCUMENT_SOON_DAYS * DAY_MS)
    const dueAt = atMorning(d.expiryDate)
    const remainingAt = (t: number) => Math.max(0, Math.ceil((d.expiryDate! - t) / DAY_MS))
    if (dueAt <= now) {
      out.push({ key: `${base}:due`, carId: b.car.id, kind: 'document', stage: 'due', at: dueAt, title: `${prefix}${name}`, body: 'Срок действия истёк', approximate: false })
    } else {
      const left = soonAt <= now ? remainingAt(now) : DOCUMENT_SOON_DAYS
      out.push({ key: `${base}:soon`, carId: b.car.id, kind: 'document', stage: 'soon', at: soonAt, title: `${prefix}${name}`, body: `Срок действия истекает ${inDays(left)}`, approximate: false })
      out.push({ key: `${base}:due`, carId: b.car.id, kind: 'document', stage: 'due', at: dueAt, title: `${prefix}${name}`, body: 'Срок действия истёк', approximate: false })
    }
  }
  return out
}

function warrantyAlerts(b: CarBundle, now: number, multi: boolean): Alert[] {
  const prefix = multi ? `${carLabel(b.car)}: ` : ''
  const out: Alert[] = []
  for (const w of buildWarranties(b.history, b.expenses, now)) {
    const soonAt = atMorning(w.endsAt - 30 * DAY_MS)
    out.push({
      key: `w:${w.key}:soon`,
      carId: b.car.id,
      kind: 'warranty',
      stage: 'soon',
      at: soonAt,
      title: `${prefix}Гарантия: ${w.name}`,
      body: soonAt <= now ? `Осталось ${w.remainingDays} ${daysWord(w.remainingDays)} — проверьте деталь, пока она на гарантии` : 'Осталось 30 дней — проверьте деталь, пока она на гарантии',
      approximate: false,
    })
  }
  return out
}

/** Every alert that applies now or is coming, for all the cars given. Sorted by time. */
export function computeAlerts(bundles: CarBundle[], now: number): Alert[] {
  const multi = bundles.length > 1
  const all: Alert[] = []
  for (const b of bundles) {
    all.push(...serviceAlerts(b, now, multi), ...reminderAlerts(b, now, multi), ...documentAlerts(b, now, multi), ...warrantyAlerts(b, now, multi))
  }
  return all.sort((a, z) => a.at - z.at)
}

const KIND_ORDER: Record<AlertKind, number> = { service: 0, document: 1, reminder: 2, warranty: 3 }

/**
 * Merges alerts of the same car that start at the same moment into one
 * notification, so a morning with five due things is one message, not five.
 */
export function groupIntoNotes(alerts: Alert[], carNames: Map<string, string>): Note[] {
  const groups = new Map<string, Alert[]>()
  for (const a of alerts) {
    const id = `${a.carId}@${a.at}`
    groups.set(id, [...(groups.get(id) ?? []), a])
  }
  const notes: Note[] = []
  for (const [id, list] of groups) {
    const sorted = list.slice().sort((a, z) => KIND_ORDER[a.kind] - KIND_ORDER[z.kind] || (a.stage === 'due' ? -1 : 1))
    const carId = sorted[0].carId
    if (sorted.length === 1) {
      notes.push({ key: `n:${id}`, carId, at: sorted[0].at, title: sorted[0].title, body: sorted[0].body, memberKeys: [sorted[0].key] })
      continue
    }
    const car = carNames.get(carId) ?? 'Моя машина'
    const word = sorted.length % 10 >= 2 && sorted.length % 10 <= 4 && (sorted.length % 100 < 10 || sorted.length % 100 >= 20) ? 'дела' : 'дел'
    notes.push({
      key: `n:${id}`,
      carId,
      at: sorted[0].at,
      title: `${car}: ${sorted.length} ${word}`,
      body: sorted.map((a) => `${a.title.replace(/^[^:]+: /, '')} — ${a.body}`).join('\n'),
      memberKeys: sorted.map((a) => a.key),
    })
  }
  return notes.sort((a, z) => a.at - z.at)
}
