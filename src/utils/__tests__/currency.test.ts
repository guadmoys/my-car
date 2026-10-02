import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('currency', () => {
  beforeEach(() => {
    vi.resetModules()
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
  })

  it('defaults to rubles and rounds amounts', async () => {
    const { formatMoney } = await import('../currency')
    expect(formatMoney(1234.6).replace(/\s/g, ' ')).toBe('1 235 ₽')
  })

  it('switches symbol and persists it', async () => {
    const { formatMoney, setCurrency, formatPricePerLiter } = await import('../currency')
    setCurrency('€')
    expect(formatMoney(10)).toBe('10 €')
    expect(formatPricePerLiter(54.321)).toBe('54.3 €/л')
    expect(localStorage.getItem('my-car-currency')).toBe('€')
  })

  it('ignores an unknown stored symbol', async () => {
    localStorage.setItem('my-car-currency', 'XYZ')
    const { currency } = await import('../currency')
    expect(currency.value).toBe('₽')
  })
})
