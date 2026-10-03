import type { Car, CostForecast, FuelConsumption, FuelEntry, FuelInsight, HistoryEntry, MaintenanceItem } from '../types'
import { DAY_MS } from './dates'

// Everything in here is pure: fuel/service data in, numbers and texts out. It lives
// outside the store so it can be tested on its own and reused for any car.

export interface ConsumptionAnalysis {
  history: FuelConsumption[]
  average: number | null
  currentLevelLiters: number | null
}

/**
 * A tank level expressed as `c + k * tankCapacity` liters, so a full-tank
 * reading stays exact even when the car's tank capacity isn't known: as
 * long as a segment both starts and ends on a full tank, the `k` terms
 * cancel out and the capacity is never actually needed.
 */
interface TankLevel {
  c: number
  k: number
}

function fuelLevels(entry: FuelEntry): { before: TankLevel; after: TankLevel } | null {
  const isFull = entry.isFullTank ?? true
  if (isFull) {
    return { before: { c: -entry.liters, k: 1 }, after: { c: 0, k: 1 } }
  }
  if (entry.remainingLiters !== undefined) {
    return {
      before: { c: entry.remainingLiters, k: 0 },
      after: { c: entry.remainingLiters + entry.liters, k: 0 },
    }
  }
  return null
}

function resolveLevel(level: TankLevel, tankCapacity: number | undefined): number | null {
  if (level.k === 0) return level.c
  return tankCapacity !== undefined ? level.c + level.k * tankCapacity : null
}

export function analyzeConsumption(
  fuelEntries: FuelEntry[],
  car: Pick<Car, 'tankCapacity' | 'initialMileage'>,
): ConsumptionAnalysis {
  const capacity = car.tankCapacity
  const sorted = fuelEntries.slice().sort((a, b) => a.mileage - b.mileage)

  let anchorAfter: TankLevel = { c: 0, k: 1 }
  let anchorMileage = car.initialMileage
  let interimLiters = 0
  let previousMileage = car.initialMileage
  // The very first anchor assumes a full tank at initialMileage, which is
  // just a guess (the car could've been added mid-tank) — not confirmed by
  // any real entry yet. So the very first resolved fill-up's segment is
  // skipped rather than counted on a guessed starting level; that fill-up's
  // own observed level then becomes a real, trustworthy anchor from then on.
  let anchorConfirmed = false

  let totalBurned = 0
  let totalDistance = 0

  const rows = sorted.map((entry) => {
    const distanceKm = entry.mileage - previousMileage
    previousMileage = entry.mileage

    const levels = fuelLevels(entry)
    let litersPer100km: number | null = null

    if (levels) {
      if (!anchorConfirmed) {
        anchorAfter = levels.after
        anchorMileage = entry.mileage
        interimLiters = 0
        anchorConfirmed = true
      } else {
        const combined: TankLevel = {
          c: anchorAfter.c + interimLiters - levels.before.c,
          k: anchorAfter.k - levels.before.k,
        }
        const burned = resolveLevel(combined, capacity)
        const distance = entry.mileage - anchorMileage
        if (burned !== null && burned >= 0 && distance > 0) {
          litersPer100km = (burned / distance) * 100
          totalBurned += burned
          totalDistance += distance
          anchorAfter = levels.after
          anchorMileage = entry.mileage
          interimLiters = 0
        } else {
          // A bad/out-of-order mileage (or fuel math that doesn't add up) for
          // this entry must not become the new reference point — every later
          // entry's distance/burned would then be measured from a corrupted
          // anchor. Fold its liters into the running interim total instead
          // (same as an unresolved fill-up below), so the fuel still counts
          // once a later, trustworthy entry closes the loop, while the last
          // good anchor stays in place.
          interimLiters += entry.liters
        }
      }
    } else {
      interimLiters += entry.liters
    }

    return { entry, distanceKm, litersPer100km }
  })

  const average = totalDistance > 0 ? (totalBurned / totalDistance) * 100 : null
  const currentLevelLiters = resolveLevel({ c: anchorAfter.c + interimLiters, k: anchorAfter.k }, capacity)

  const history: FuelConsumption[] = rows
    .map(({ entry, distanceKm, litersPer100km }) => {
      let quality: FuelConsumption['quality'] = 'neutral'
      if (litersPer100km !== null && average !== null) {
        quality = litersPer100km <= average * 1.03 ? 'good' : 'bad'
      }
      return { entry, distanceKm, litersPer100km, quality }
    })
    .reverse()

  return { history, average, currentLevelLiters }
}

/**
 * Estimated remaining range, when the current tank level is known (needs
 * either a full-tank fill-up or a tracked tank capacity) and there's an
 * average consumption to project it against.
 */
export function estimatedRange(currentLevelLiters: number | null, averageConsumption: number | null): number | null {
  if (currentLevelLiters === null || currentLevelLiters < 0 || averageConsumption === null || averageConsumption <= 0) return null
  return (currentLevelLiters / averageConsumption) * 100
}

export function averageFuelPrice(fuelEntries: Pick<FuelEntry, 'cost' | 'liters'>[]): number | null {
  const priced = fuelEntries.filter((e) => e.cost !== undefined && e.liters > 0)
  if (priced.length === 0) return null
  const totalCost = priced.reduce((sum, e) => sum + (e.cost as number), 0)
  const totalLiters = priced.reduce((sum, e) => sum + e.liters, 0)
  return totalCost / totalLiters
}

function co2FactorForFuelType(fuelType: string | undefined): number {
  if (fuelType?.includes('Дизель')) return 2.68
  if (fuelType?.includes('Газ')) return 1.51
  return 2.31 // gasoline (АИ-92/95/98), also the default when the grade wasn't recorded
}

export function totalCo2Kg(fuelEntries: Pick<FuelEntry, 'liters' | 'fuelType'>[]): number {
  return fuelEntries.reduce((sum, e) => sum + e.liters * co2FactorForFuelType(e.fuelType), 0)
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function daysWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

function fillupsWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'заправка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'заправки'
  return 'заправок'
}

export interface InsightContext {
  car: Pick<Car, 'referenceConsumptionL100km'>
  fuelEntries: FuelEntry[]
  /** Newest first, as produced by analyzeConsumption. */
  history: FuelConsumption[]
  averageConsumption: number | null
  /** Estimated remaining range in km, when known. */
  rangeKm: number | null
  dailyKm: number | null
  /** Currency symbol shown in the texts. */
  currency: string
  now: number
}

export function buildFuelInsights(ctx: InsightContext): FuelInsight[] {
  const { fuelEntries, history, car } = ctx
  const insights: FuelInsight[] = []
  const validSegments = history.filter((row) => row.litersPer100km !== null)
  const byDate = fuelEntries.slice().sort((a, b) => a.date - b.date)

  // Consumption trend: last 3 valid segments vs the 3 before them.
  if (validSegments.length >= 5) {
    const recent = validSegments.slice(0, 3).map((r) => r.litersPer100km as number)
    const prior = validSegments.slice(3, 6).map((r) => r.litersPer100km as number)
    if (prior.length >= 2) {
      const avgRecent = average(recent)
      const avgPrior = average(prior)
      const diffPct = ((avgRecent - avgPrior) / avgPrior) * 100
      if (diffPct <= -5) {
        insights.push({
          id: 'trend',
          icon: '📉',
          text: `Расход снижается: последние заправки в среднем на ${Math.abs(diffPct).toFixed(0)}% экономичнее, чем раньше`,
          tone: 'good',
        })
      } else if (diffPct >= 15) {
        insights.push({
          id: 'trend',
          icon: '⚠️',
          text: `Расход заметно вырос (+${diffPct.toFixed(0)}%) — стоит проверить давление в шинах, воздушный фильтр или стиль вождения`,
          tone: 'bad',
        })
      } else if (diffPct >= 5) {
        insights.push({
          id: 'trend',
          icon: '📈',
          text: `Расход растёт: последние заправки в среднем на ${diffPct.toFixed(0)}% больше, чем раньше`,
          tone: 'bad',
        })
      }
    }
  }

  // Anomaly detector: flags one fill-up whose л/100км is a statistical
  // outlier (z-score) against the rest, rather than a gradual drift like
  // the trend insight above. A high positive z-score is usually a data
  // entry slip (wrong mileage/liters) or a real mechanical issue; a sharply
  // negative one is almost always a typo, since consumption can't improve
  // that much between two fill-ups.
  if (validSegments.length >= 5) {
    // Judge the latest fill-up against the ones before it. Including it in its
    // own baseline caps the z-score at sqrt(n-1), so with a handful of fill-ups
    // even an extreme outlier could never reach the threshold.
    const latest = validSegments[0].litersPer100km as number
    const values = validSegments.slice(1).map((r) => r.litersPer100km as number)
    const mean = average(values)
    const variance = average(values.map((v) => (v - mean) ** 2))
    const stddev = Math.sqrt(variance)
    if (stddev > 0) {
      const z = (latest - mean) / stddev
      if (z >= 2) {
        insights.push({
          id: 'anomaly',
          icon: '🚨',
          text: `Последняя заправка сильно выбивается из общей картины: ${latest.toFixed(1)} л/100км против обычных ~${mean.toFixed(1)} — проверьте введённые данные или состояние авто (давление в шинах, утечки, форсунки)`,
          tone: 'bad',
        })
      } else if (z <= -2) {
        insights.push({
          id: 'anomaly',
          icon: '🧐',
          text: `Последняя заправка выглядит подозрительно экономичной: ${latest.toFixed(1)} л/100км против обычных ~${mean.toFixed(1)} — стоит перепроверить введённый пробег и литры`,
          tone: 'bad',
        })
      }
    }
  }

  // Efficiency streak: consecutive recent fill-ups better than average.
  let streak = 0
  for (const row of validSegments) {
    if (row.quality !== 'good') break
    streak++
  }
  if (streak >= 3) {
    insights.push({
      id: 'streak',
      icon: '🔥',
      text: `${streak} ${fillupsWord(streak)} подряд экономичнее среднего — отличная динамика!`,
      tone: 'good',
    })
  }

  // Estimated remaining range, when the current tank level is known
  // (needs either a full-tank fill-up or a tracked tank capacity), plus a
  // days-until-empty guess when there's enough driving history for a pace.
  const rangeKm = ctx.rangeKm
  if (rangeKm !== null) {
    const daily = ctx.dailyKm
    const daysUntilEmpty = daily !== null && daily > 0 ? rangeKm / daily : null
    const daysSuffix =
      daysUntilEmpty !== null ? ` (~${Math.round(daysUntilEmpty)} ${daysWord(Math.round(daysUntilEmpty))} при вашем темпе)` : ''
    if (rangeKm <= 60) {
      insights.push({
        id: 'range',
        icon: '⛽',
        text: `Топлива осталось примерно на ${Math.round(rangeKm)} км${daysSuffix} — скоро на заправку`,
        tone: 'bad',
      })
    } else {
      insights.push({
        id: 'range',
        icon: '🛣',
        text: `Ориентировочный запас хода: ~${Math.round(rangeKm)} км${daysSuffix}`,
        tone: 'neutral',
      })
    }
  }

  // Comparison against a user-entered reference consumption (e.g. from the
  // manual) — the closest this offline, backend-less app can get to the
  // "vs. average for this model" benchmarks crowdsourced apps offer, since
  // there's no fleet data to compare against here.
  const reference = car.referenceConsumptionL100km
  if (reference !== undefined && reference > 0 && ctx.averageConsumption !== null) {
    const diffPct = ((ctx.averageConsumption - reference) / reference) * 100
    if (Math.abs(diffPct) >= 5) {
      insights.push({
        id: 'reference',
        icon: diffPct > 0 ? '📛' : '✅',
        text:
          diffPct > 0
            ? `Средний расход на ${diffPct.toFixed(0)}% выше заданного эталона (${reference.toFixed(1)} л/100км)`
            : `Средний расход на ${Math.abs(diffPct).toFixed(0)}% ниже заданного эталона (${reference.toFixed(1)} л/100км) — экономичнее ожидаемого`,
        tone: diffPct > 0 ? 'bad' : 'good',
      })
    }
  }

  // Fuel budget forecast: rolling 30-day spend rate, projected forward.
  // Needs a real spread of dates — otherwise a batch of fill-ups entered
  // all at once (e.g. backfilling history) would wildly inflate the rate.
  const now = ctx.now
  const recentPriced = fuelEntries.filter((e) => e.date >= now - 30 * DAY_MS && e.cost !== undefined)
  if (recentPriced.length >= 2) {
    const earliestDate = Math.min(...recentPriced.map((e) => e.date))
    const daysSpan = (now - earliestDate) / DAY_MS
    if (daysSpan >= 3) {
      const totalSpent = recentPriced.reduce((sum, e) => sum + (e.cost as number), 0)
      const projected = (totalSpent / daysSpan) * 30
      insights.push({
        id: 'budget',
        icon: '📊',
        text: `За последние ${Math.round(daysSpan)} дн. на топливо потрачено ${Math.round(totalSpent).toLocaleString('ru-RU')} ${ctx.currency} — при таком темпе выйдет ~${Math.round(projected).toLocaleString('ru-RU')} ${ctx.currency} за 30 дней`,
        tone: 'neutral',
      })
    }
  }

  // Seasonal comparison: winter (Dec-Feb) vs summer (Jun-Aug) consumption.
  const winterVals = validSegments
    .filter((r) => [11, 0, 1].includes(new Date(r.entry.date).getMonth()))
    .map((r) => r.litersPer100km as number)
  const summerVals = validSegments
    .filter((r) => [5, 6, 7].includes(new Date(r.entry.date).getMonth()))
    .map((r) => r.litersPer100km as number)
  if (winterVals.length >= 2 && summerVals.length >= 2) {
    const winterAvg = average(winterVals)
    const summerAvg = average(summerVals)
    const diffPct = ((winterAvg - summerAvg) / summerAvg) * 100
    if (diffPct >= 8) {
      insights.push({
        id: 'seasonal',
        icon: '❄️',
        text: `Зимой расход в среднем на ${diffPct.toFixed(0)}% выше, чем летом (${winterAvg.toFixed(1)} против ${summerAvg.toFixed(1)} л/100км)`,
        tone: 'neutral',
      })
    }
  }

  // Price trend: latest fill vs the historical average price per liter.
  const priced = byDate
    .filter((e) => e.cost !== undefined && e.liters > 0)
    .map((e) => ({ entry: e, price: (e.cost as number) / e.liters }))
  if (priced.length >= 3) {
    const last = priced[priced.length - 1]
    const prevAvg = average(priced.slice(0, -1).map((p) => p.price))
    const diffPct = ((last.price - prevAvg) / prevAvg) * 100
    if (diffPct >= 7) {
      insights.push({
        id: 'price',
        icon: '💸',
        text: `Последняя заправка дороже обычного на ${diffPct.toFixed(0)}% (${last.price.toFixed(1)} ${ctx.currency}/л против ${prevAvg.toFixed(1)} ${ctx.currency}/л в среднем)`,
        tone: 'bad',
      })
    } else if (diffPct <= -7) {
      insights.push({
        id: 'price',
        icon: '💰',
        text: `Последняя заправка дешевле обычного на ${Math.abs(diffPct).toFixed(0)}% (${last.price.toFixed(1)} ${ctx.currency}/л против ${prevAvg.toFixed(1)} ${ctx.currency}/л в среднем)`,
        tone: 'good',
      })
    }
  }

  // Cheapest gas station, when at least two stations have price data.
  const stationGroups = new Map<string, { total: number; liters: number }>()
  for (const e of fuelEntries) {
    if (!e.station || e.cost === undefined || e.liters <= 0) continue
    const g = stationGroups.get(e.station) ?? { total: 0, liters: 0 }
    g.total += e.cost
    g.liters += e.liters
    stationGroups.set(e.station, g)
  }
  if (stationGroups.size >= 2) {
    const ranked = Array.from(stationGroups.entries())
      .map(([station, g]) => ({ station, avgPrice: g.total / g.liters }))
      .sort((a, b) => a.avgPrice - b.avgPrice)
    const best = ranked[0]
    const worst = ranked[ranked.length - 1]
    if (best.avgPrice <= worst.avgPrice * 0.97) {
      insights.push({
        id: 'station',
        icon: '📍',
        text: `Самая выгодная АЗС — «${best.station}»: в среднем ${best.avgPrice.toFixed(1)} ${ctx.currency}/л`,
        tone: 'good',
      })
    }
  }

  // Fuel grade comparison, when at least two grades have consumption data.
  const typeGroups = new Map<string, number[]>()
  for (const row of history) {
    if (row.litersPer100km === null || !row.entry.fuelType) continue
    const arr = typeGroups.get(row.entry.fuelType) ?? []
    arr.push(row.litersPer100km)
    typeGroups.set(row.entry.fuelType, arr)
  }
  const rankedTypes = Array.from(typeGroups.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([type, arr]) => ({ type, avg: average(arr) }))
    .sort((a, b) => a.avg - b.avg)
  if (rankedTypes.length >= 2) {
    const best = rankedTypes[0]
    const worst = rankedTypes[rankedTypes.length - 1]
    const diffPct = ((worst.avg - best.avg) / worst.avg) * 100
    if (diffPct >= 5) {
      insights.push({
        id: 'fuel-type',
        icon: '🔬',
        text: `На ${best.type} расход в среднем на ${diffPct.toFixed(0)}% ниже, чем на ${worst.type}`,
        tone: 'neutral',
      })
    }
  }

  // Fill-up frequency.
  if (byDate.length >= 3) {
    const gapsDays: number[] = []
    for (let i = 1; i < byDate.length; i++) {
      gapsDays.push((byDate[i].date - byDate[i - 1].date) / (24 * 60 * 60 * 1000))
    }
    const avgGapDays = Math.round(average(gapsDays))
    if (avgGapDays >= 1) {
      insights.push({
        id: 'frequency',
        icon: '🗓',
        text: `В среднем вы заправляетесь раз в ${avgGapDays} ${daysWord(avgGapDays)}`,
        tone: 'neutral',
      })
    }
  }

  // Cost per km driven, over the whole fuel-tracked mileage span.
  if (byDate.length >= 2) {
    const distance = byDate[byDate.length - 1].mileage - byDate[0].mileage
    const totalSpent = fuelEntries.reduce((sum, e) => sum + (e.cost ?? 0), 0)
    if (distance > 0 && totalSpent > 0) {
      insights.push({
        id: 'cost-per-km',
        icon: '🧮',
        text: `Топливо обходится примерно в ${(totalSpent / distance).toFixed(2)} ${ctx.currency}/км пробега`,
        tone: 'neutral',
      })
    }
  }

  return insights.slice(0, 6)
}

/**
 * Km driven since the start of the current calendar month, measured against
 * the most recent known mileage reading dated before this month (a fuel
 * entry, a completed service, or — failing either — the car's own creation
 * point). That fallback means a car added this month reports its full
 * mileage-to-date rather than an undefined gap.
 */
export function monthDistance(
  car: Pick<Car, 'initialMileage' | 'createdAt' | 'currentMileage'>,
  fuelEntries: Pick<FuelEntry, 'mileage' | 'date'>[],
  historyEntries: Pick<HistoryEntry, 'mileage' | 'date'>[],
  now: number,
): number {
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()
  const points = [
    { mileage: car.initialMileage, date: car.createdAt },
    ...fuelEntries.map((e) => ({ mileage: e.mileage, date: e.date })),
    ...historyEntries.map((h) => ({ mileage: h.mileage, date: h.date })),
  ].sort((a, b) => a.date - b.date)

  const before = points.filter((p) => p.date < monthStart)
  const baseline = before.length > 0 ? before[before.length - 1] : points[0]
  return Math.max(0, car.currentMileage - baseline.mileage)
}

const MONTH_DAYS = 30.44

/**
 * Expected number of times an item will trigger within `days`. Items with
 * a month-based interval use that cadence directly; purely km-based items
 * need a driving-pace estimate (avgDailyKm) — without one, they're left out
 * rather than guessed at.
 */
function expectedServicesIn(items: Pick<MaintenanceItem, 'intervalMonths' | 'intervalKm'>[], days: number, dailyKm: number | null): number {
  let count = 0
  for (const item of items) {
    if (item.intervalMonths) {
      count += days / (item.intervalMonths * MONTH_DAYS)
    } else if (dailyKm !== null && dailyKm > 0 && item.intervalKm > 0) {
      count += (dailyKm * days) / item.intervalKm
    }
  }
  return count
}

/**
 * Cost-of-ownership projection for 6 and 12 months out: a fuel-spend rate
 * (recent 90-day window, falling back to the full tracked history) times
 * the horizon, plus an expected maintenance cost — the average priced
 * service times how many services the tracked items are expected to
 * trigger in that horizon. A rough estimate by design (one flat average
 * service cost, not a per-item one), not a budgeting tool.
 */
export function forecastCosts(input: {
  fuelEntries: Pick<FuelEntry, 'date' | 'cost'>[]
  historyEntries: Pick<HistoryEntry, 'cost'>[]
  items: Pick<MaintenanceItem, 'intervalMonths' | 'intervalKm'>[]
  dailyKm: number | null
  now: number
}): { sixMonths: CostForecast | null; twelveMonths: CostForecast | null } {
  const { fuelEntries, historyEntries, items, dailyKm } = input

  const priced = fuelEntries.filter((e) => e.cost !== undefined).sort((a, b) => a.date - b.date)
  if (priced.length < 2) return { sixMonths: null, twelveMonths: null }

  const now = input.now
  const recentWindow = priced.filter((e) => e.date >= now - 90 * DAY_MS)
  const windowEntries = recentWindow.length >= 2 ? recentWindow : priced
  const daysSpan = (now - windowEntries[0].date) / DAY_MS
  if (daysSpan < 3) return { sixMonths: null, twelveMonths: null }
  const dailyFuelRate =
    windowEntries.reduce((sum, e) => sum + (e.cost as number), 0) / daysSpan

  const pricedHistory = historyEntries.filter((h) => h.cost !== undefined)
  const avgServiceCost =
    pricedHistory.length > 0
      ? pricedHistory.reduce((sum, h) => sum + (h.cost as number), 0) / pricedHistory.length
      : 0

  function forecastFor(days: number): CostForecast {
    const fuel = dailyFuelRate * days
    const maintenance = expectedServicesIn(items, days, dailyKm) * avgServiceCost
    return { fuel, maintenance, total: fuel + maintenance }
  }

  return { sixMonths: forecastFor(6 * MONTH_DAYS), twelveMonths: forecastFor(12 * MONTH_DAYS) }
}
