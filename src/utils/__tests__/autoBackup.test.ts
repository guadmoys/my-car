import { describe, expect, it } from 'vitest'
import { isDailySnapshotDue, snapshotsToPrune } from '../backup/autoBackup'

const DAY = 24 * 60 * 60 * 1000

describe('snapshotsToPrune', () => {
  it('keeps the newest three daily copies', () => {
    const list = [1, 2, 3, 4, 5].map((n) => ({ savedAt: n * DAY, reason: 'daily' as const }))
    expect(snapshotsToPrune(list).sort((a, b) => a - b)).toEqual([DAY, 2 * DAY])
  })

  it('keeps the newest two pre-import copies independently', () => {
    const list = [
      ...[1, 2, 3].map((n) => ({ savedAt: n, reason: 'before-import' as const })),
      ...[10, 11].map((n) => ({ savedAt: n, reason: 'daily' as const })),
    ]
    expect(snapshotsToPrune(list)).toEqual([1])
  })

  it('prunes nothing when under the limits', () => {
    expect(snapshotsToPrune([{ savedAt: 1, reason: 'daily' }])).toEqual([])
  })
})

describe('isDailySnapshotDue', () => {
  it('is due with no copies', () => {
    expect(isDailySnapshotDue([], 5 * DAY)).toBe(true)
  })
  it('is not due within a day of the newest daily copy', () => {
    expect(isDailySnapshotDue([{ savedAt: 4.5 * DAY, reason: 'daily' }], 5 * DAY)).toBe(false)
  })
  it('ignores pre-import copies', () => {
    expect(isDailySnapshotDue([{ savedAt: 4.9 * DAY, reason: 'before-import' }], 5 * DAY)).toBe(true)
  })
})
