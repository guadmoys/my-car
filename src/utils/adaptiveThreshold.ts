const DAY_MS = 24 * 60 * 60 * 1000

export interface ThresholdResult {
  value: number
  /** True when the lead time was actually widened by history — false for
   * an explicit override or the plain static-default fallback. Lets the UI
   * explain why the shown number differs from the flat 10% default. */
  adaptive: boolean
}

function averageGap(sortedValues: number[]): number | null {
  if (sortedValues.length < 3) return null
  let sum = 0
  for (let i = 1; i < sortedValues.length; i++) sum += sortedValues[i] - sortedValues[i - 1]
  return sum / (sortedValues.length - 1)
}

/**
 * How far before the due point (km or days, same unit as `interval`) an
 * item should flip to "soon". Defaults to 10% of the interval — but when
 * there's a clear multi-cycle history (3+ completions) of the item being
 * serviced earlier than the declared interval, the threshold widens to
 * match that average lead time, so "soon" actually lands before the point
 * the user tends to act, capped at 40% of the interval so it can never
 * swallow the whole cycle. Never applied over an explicit override, and
 * never narrows the threshold below the static default.
 */
function adaptiveThreshold(
  interval: number,
  explicitOverride: number | undefined,
  sortedHistory: number[],
): ThresholdResult {
  const staticDefault = interval * 0.1
  if (explicitOverride !== undefined) return { value: explicitOverride, adaptive: false }
  const avgGap = averageGap(sortedHistory)
  if (avgGap === null) return { value: staticDefault, adaptive: false }
  const lead = interval - avgGap
  if (lead <= staticDefault) return { value: staticDefault, adaptive: false }
  return { value: Math.min(lead, interval * 0.4), adaptive: true }
}

export function adaptiveKmThreshold(
  intervalKm: number,
  notifyBeforeKm: number | undefined,
  historyMileages: number[],
): ThresholdResult {
  return adaptiveThreshold(intervalKm, notifyBeforeKm, historyMileages.slice().sort((a, b) => a - b))
}

/** Same idea as adaptiveKmThreshold, for the days-based interval.
 * `totalSpanMs` is the full interval-months span in ms (dueAtDate - lastServiceDate). */
export function adaptiveDayThreshold(
  totalSpanMs: number,
  notifyBeforeDays: number | undefined,
  historyDatesMs: number[],
): ThresholdResult {
  const totalSpanDays = totalSpanMs / DAY_MS
  const sortedDays = historyDatesMs
    .slice()
    .sort((a, b) => a - b)
    .map((d) => d / DAY_MS)
  return adaptiveThreshold(totalSpanDays, notifyBeforeDays, sortedDays)
}
