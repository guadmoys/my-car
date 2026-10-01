import { describe, expect, it } from 'vitest'
import type { Car, CarDocument, Expense } from '../../types'
import { documentStatus, documentStatuses, migrateLegacyToDocuments } from '../documents'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_000_000 * DAY

const doc = (over: Partial<CarDocument> = {}): CarDocument => ({
  id: 'd1',
  carId: 'c1',
  type: 'insurance',
  photos: [],
  createdAt: 0,
  ...over,
})

describe('documentStatus', () => {
  it('has no status without an expiry date', () => {
    expect(documentStatus(doc(), NOW)).toBeNull()
  })

  it('is due on and after the expiry day', () => {
    expect(documentStatus(doc({ expiryDate: NOW }), NOW)).toMatchObject({ isDue: true, isSoon: false, remainingDays: 0 })
    expect(documentStatus(doc({ expiryDate: NOW - 3 * DAY }), NOW)?.isDue).toBe(true)
  })

  it('is soon within 30 days and ok beyond', () => {
    expect(documentStatus(doc({ expiryDate: NOW + 30 * DAY }), NOW)).toMatchObject({ isDue: false, isSoon: true })
    expect(documentStatus(doc({ expiryDate: NOW + 31 * DAY }), NOW)).toMatchObject({ isDue: false, isSoon: false })
  })
})

describe('documentStatuses', () => {
  it('sorts the most urgent first and skips undated documents', () => {
    const list = documentStatuses(
      [doc({ id: 'a', expiryDate: NOW + 10 * DAY }), doc({ id: 'b' }), doc({ id: 'c', expiryDate: NOW - DAY })],
      NOW,
    )
    expect(list.map((s) => s.document.id)).toEqual(['c', 'a'])
  })
})

const car = { id: 'c1', make: 'A', model: 'B', year: 2020, initialMileage: 0, currentMileage: 0, createdAt: 0, updatedAt: 0 } as Car
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  carId: 'c1',
  category: 'insurance',
  amount: 10000,
  date: NOW - 100 * DAY,
  ...over,
})

describe('migrateLegacyToDocuments', () => {
  it('does nothing for clean data', () => {
    const r = migrateLegacyToDocuments([car], [expense()], [], NOW)
    expect(r).toEqual({ documents: [], cars: [], expenses: [] })
  })

  it('moves the STS number and photos off the car', () => {
    const r = migrateLegacyToDocuments([{ ...car, stsNumber: ' 99 00 123456 ', photos: ['p1', 'p2'] }], [], [], NOW)
    expect(r.documents.map((d) => [d.type, d.number, d.photos])).toEqual([
      ['sts', '99 00 123456', []],
      ['other', undefined, ['p1', 'p2']],
    ])
    expect(r.cars[0]).not.toHaveProperty('stsNumber')
    expect(r.cars[0]).not.toHaveProperty('photos')
  })

  it('turns an expense renewal date into a document and keeps the cost', () => {
    const r = migrateLegacyToDocuments([car], [expense({ title: 'ОСАГО', renewalDate: NOW + 5 * DAY, note: 'n' })], [], NOW)
    expect(r.documents[0]).toMatchObject({
      id: 'doc-expense-e1',
      type: 'insurance',
      title: 'ОСАГО',
      expiryDate: NOW + 5 * DAY,
      issuedDate: NOW - 100 * DAY,
      note: 'n',
    })
    expect(r.expenses[0]).not.toHaveProperty('renewalDate')
    expect(r.expenses[0].amount).toBe(10000)
  })

  it('maps tax to tax and everything else to other', () => {
    const r = migrateLegacyToDocuments(
      [car],
      [expense({ id: 'a', category: 'tax', renewalDate: 1 }), expense({ id: 'b', category: 'loan', renewalDate: 1 })],
      [],
      NOW,
    )
    expect(r.documents.map((d) => d.type)).toEqual(['tax', 'other'])
  })

  it('is idempotent: existing documents are not duplicated', () => {
    const exp = expense({ renewalDate: NOW })
    const first = migrateLegacyToDocuments([car], [exp], [], NOW)
    const second = migrateLegacyToDocuments([car], [exp], first.documents, NOW)
    expect(second.documents).toEqual([])
  })
})

describe('expiryLabel / statusColor', () => {
  it('describes overdue, today and upcoming', async () => {
    const { expiryLabel, statusColor } = await import('../documents')
    const at = (days: number) => documentStatus(doc({ expiryDate: NOW + days * DAY }), NOW)!
    expect(expiryLabel(at(-3))).toBe('Просрочен на 3 дн.')
    expect(expiryLabel(at(0))).toBe('Истекает сегодня')
    expect(expiryLabel(at(12))).toBe('Осталось 12 дн.')
    expect(statusColor(at(-1))).toBe('due')
    expect(statusColor(at(5))).toBe('soon')
    expect(statusColor(at(90))).toBeUndefined()
    expect(statusColor(null)).toBeUndefined()
  })
})
