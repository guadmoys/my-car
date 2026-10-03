import { describe, expect, it } from 'vitest'
import { parseExpenseQuickEntry } from '../expenseQuickEntry'
import { parseReceiptText } from '../receiptText'
import { compareMonths } from '../monthComparison'

describe('parseExpenseQuickEntry', () => {
  it('reads category, amount and title', () => {
    expect(parseExpenseQuickEntry('осаго 12 000')).toMatchObject({ amount: 12000, category: 'insurance', title: 'Осаго' })
    expect(parseExpenseQuickEntry('штраф 500р')).toMatchObject({ amount: 500, category: 'fine' })
    expect(parseExpenseQuickEntry('ремонт бампера 45к')).toMatchObject({ amount: 45000, category: 'damage', title: 'Ремонт бампера' })
    expect(parseExpenseQuickEntry('кредит 1 200,50')).toMatchObject({ amount: 1200.5, category: 'loan' })
  })
  it('picks the biggest number and tolerates missing parts', () => {
    expect(parseExpenseQuickEntry('2 бампера 45000').amount).toBe(45000)
    expect(parseExpenseQuickEntry('что-то').amount).toBeUndefined()
    expect(parseExpenseQuickEntry('')).toEqual({})
    expect(parseExpenseQuickEntry('автомойка 300').category).toBeUndefined()
    expect(parseExpenseQuickEntry('техосмотр 1500').category).toBe('tax')
  })
})

describe('parseReceiptText', () => {
  const now = new Date(2026, 9, 3).getTime()
  it('prefers the labelled total and finds the date', () => {
    const r = parseReceiptText('АЗС 12\n03.10.2026 14:22\nБензин 40,00 л\nИТОГО: 2 150,00\nНДС 358,33', now)
    expect(r.amount).toBe(2150)
    expect(new Date(r.date!).getDate()).toBe(3)
  })
  it('falls back to the largest amount and ignores future or invalid dates', () => {
    const r = parseReceiptText('товар 10,50 услуга 99,90 31.02.2026 01.01.2030', now)
    expect(r.amount).toBe(99.9)
    expect(r.date).toBeUndefined()
  })
})

describe('compareMonths', () => {
  it('compares with the previous month and names the biggest mover', () => {
    const now = new Date(2026, 5, 15).getTime()
    const cur = new Date(2026, 5, 2).getTime()
    const prev = new Date(2026, 4, 20).getTime()
    const r = compareMonths([{ date: cur, cost: 1500 }, { date: prev, cost: 1000 }], [], [{ date: prev, amount: 500 }], now)
    expect(r.current.total).toBe(1500)
    expect(r.previous.total).toBe(1500)
    expect(r.changePct).toBe(0)
    expect(r.biggestMover?.delta).not.toBe(0)
  })
  it('has no percentage without a previous month', () => {
    const now = new Date(2026, 5, 15).getTime()
    expect(compareMonths([{ date: now, cost: 10 }], [], [], now).changePct).toBeNull()
  })
})
