import * as db from '../../db/database'
import { computeAlerts, groupIntoNotes, type Alert, type CarBundle } from './alerts'
import { DAY_MS } from '../dates'
import { META_BASELINE, META_LAST_CHECK, getMeta, markShown, pruneShown, readShown, setMeta, writeSchedule } from './alertStore'
import { isVaultEnabled } from '../security/vault'

/** Date-driven alerts older than this are not announced on first sight (e.g. a document added already expired). */
const STALE_MS = 14 * DAY_MS

/** Loads every car's data from the database (decrypting if needed) — not just the active car. */
export async function loadAllBundles(): Promise<CarBundle[]> {
  const cars = await db.getAllCars()
  return Promise.all(
    cars.map(async (car) => {
      const [items, history, fuel, reminders, documents, expenses] = await Promise.all([
        db.getMaintenanceItemsForCar(car.id),
        db.getHistoryForCar(car.id),
        db.getFuelEntriesForCar(car.id),
        db.getRemindersForCar(car.id),
        db.getDocumentsForCar(car.id),
        db.getExpensesForCar(car.id),
      ])
      return { car, items, history, fuel, reminders, documents, expenses }
    }),
  )
}

export interface CycleOptions {
  now?: number
  /** Whether notifications may be shown right now (enabled and permitted). */
  canNotify: boolean
  /** Shows one notification. */
  notify: (title: string, body: string, tag: string) => Promise<void>
  loadBundles?: () => Promise<CarBundle[]>
}

export interface CycleResult {
  delivered: number
  scheduled: number
}

function isStale(a: Alert, now: number): boolean {
  return a.kind !== 'service' && a.at < now - STALE_MS
}

/**
 * One pass of the alert engine, over all cars: delivers what is newly due,
 * then refreshes the schedule the background check works from.
 *
 * The very first pass only records what is already due, silently, so someone
 * updating the app isn't greeted by a burst of old alerts.
 */
export async function runAlertCycle(opts: CycleOptions): Promise<CycleResult> {
  const now = opts.now ?? Date.now()
  const bundles = await (opts.loadBundles ?? loadAllBundles)()
  if (bundles.length === 0) {
    await writeSchedule([])
    return { delivered: 0, scheduled: 0 }
  }

  const names = new Map(bundles.map((b) => [b.car.id, `${b.car.make} ${b.car.model}`.trim()]))
  const alerts = computeAlerts(bundles, now)
  const shown = await readShown()

  if (!(await getMeta<boolean>(META_BASELINE))) {
    await markShown(alerts.filter((a) => a.at <= now).map((a) => a.key), now)
    await setMeta(META_BASELINE, true)
    shown.clear()
    for (const k of await readShown()) shown.add(k)
  }

  let delivered = 0
  if (opts.canNotify) {
    const fresh = alerts.filter((a) => a.at <= now && !shown.has(a.key))
    const stale = fresh.filter((a) => isStale(a, now))
    await markShown(stale.map((a) => a.key), now)
    const toShow = fresh.filter((a) => !isStale(a, now))
    for (const note of groupIntoNotes(toShow, names)) {
      await opts.notify(note.title, note.body, note.key)
      await markShown(note.memberKeys, now)
      for (const k of note.memberKeys) shown.add(k)
      delivered++
    }
  }

  // What the background check will deliver later. Never written with encryption on: the texts would sit in the clear.
  let scheduled = 0
  if (isVaultEnabled()) {
    await writeSchedule([])
  } else {
    const pending = alerts.filter((a) => !shown.has(a.key) && !isStale(a, now))
    const notes = groupIntoNotes(pending, names)
    await writeSchedule(notes)
    scheduled = notes.length
  }

  await setMeta(META_LAST_CHECK, now)
  await pruneShown(now)
  return { delivered, scheduled }
}
