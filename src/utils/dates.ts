export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Adds calendar months, clamping to the end of the target month instead of
 * overflowing (31 Aug + 6 months is 28/29 Feb, not 3 Mar as plain
 * `setMonth` would give).
 */
export function addMonthsClamped(ts: number, months: number): number {
  const d = new Date(ts)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return target.getTime()
}

/** Local midnight of the day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier), DST-safe. */
export function calendarDaysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS)
}
