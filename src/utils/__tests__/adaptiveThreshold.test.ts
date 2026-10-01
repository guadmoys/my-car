import { describe, expect, it } from 'vitest'
import { adaptiveDayThreshold, adaptiveKmThreshold } from '../adaptiveThreshold'

const DAY = 24 * 60 * 60 * 1000

describe('adaptiveKmThreshold', () => {
  it('defaults to 10% of the interval', () => {
    expect(adaptiveKmThreshold(10000, undefined, [])).toEqual({ value: 1000, adaptive: false })
  })

  it('respects an explicit override', () => {
    expect(adaptiveKmThreshold(10000, 500, [0, 5000, 10000])).toEqual({ value: 500, adaptive: false })
  })

  it('needs at least three completions before adapting', () => {
    expect(adaptiveKmThreshold(10000, undefined, [0, 7000]).adaptive).toBe(false)
  })

  it('widens when the item is habitually serviced early', () => {
    const result = adaptiveKmThreshold(10000, undefined, [0, 8000, 16000])
    expect(result).toEqual({ value: 2000, adaptive: true })
  })

  it('caps the lead time at 40% of the interval', () => {
    const result = adaptiveKmThreshold(10000, undefined, [0, 1000, 2000])
    expect(result.value).toBe(4000)
  })

  it('never narrows below the static default', () => {
    const result = adaptiveKmThreshold(10000, undefined, [0, 9800, 19600])
    expect(result).toEqual({ value: 1000, adaptive: false })
  })

  it('does not depend on input order', () => {
    expect(adaptiveKmThreshold(10000, undefined, [16000, 0, 8000])).toEqual({ value: 2000, adaptive: true })
  })
})

describe('adaptiveDayThreshold', () => {
  it('works in days', () => {
    const span = 365 * DAY
    expect(adaptiveDayThreshold(span, undefined, []).value).toBeCloseTo(36.5)
    const history = [0, 300 * DAY, 600 * DAY]
    const result = adaptiveDayThreshold(span, undefined, history)
    expect(result.adaptive).toBe(true)
    expect(result.value).toBeCloseTo(65)
  })
})
