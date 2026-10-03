import { describe, expect, it } from 'vitest'
import { addMonthsClamped, calendarDaysBetween, startOfDay } from '../dates'
import { buildWarranties } from '../money/warranty'
import { buildIcsCalendar, buildIcsReminder } from '../alerts/ics'
import { buildExpensesCsv } from '../money/expensesCsv'
import { buildCostStructure } from '../money/costStructure'
import { buildPartsList } from '../money/partsList'

describe('dates', () => {
  it('clamps month overflow instead of rolling into the next month', () => {
    const aug31 = new Date(2026, 7, 31, 10, 30).getTime()
    const feb = new Date(addMonthsClamped(aug31, 6))
    expect([feb.getFullYear(), feb.getMonth(), feb.getDate(), feb.getHours()]).toEqual([2027, 1, 28, 10])
    const leap = new Date(addMonthsClamped(new Date(2027, 7, 31).getTime(), 6))
    expect([leap.getMonth(), leap.getDate()]).toEqual([1, 29]) // 2028 is a leap year
    expect(new Date(addMonthsClamped(new Date(2026, 0, 15).getTime(), 12)).getDate()).toBe(15)
    expect(new Date(addMonthsClamped(new Date(2026, 0, 15).getTime(), -2)).getMonth()).toBe(10)
  })
  it('counts calendar days regardless of time of day', () => {
    const noon = new Date(2026, 5, 10, 12).getTime()
    expect(calendarDaysBetween(noon, new Date(2026, 5, 10, 0).getTime())).toBe(0)
    expect(calendarDaysBetween(noon, new Date(2026, 5, 11, 0).getTime())).toBe(1)
    expect(calendarDaysBetween(noon, new Date(2026, 5, 9, 23).getTime())).toBe(-1)
    expect(startOfDay(noon)).toBe(new Date(2026, 5, 10).getTime())
  })
})

describe('warranty edge cases', () => {
  const part = { id: 'p', kind: 'part' as const, name: 'x', amount: 1, warrantyMonths: 6 }
  it('is still valid on its last day, even in the afternoon', () => {
    const date = new Date(2026, 0, 10).getTime()
    const lastDay = new Date(2026, 6, 10, 15).getTime()
    const rows = buildWarranties([{ id: 'h', date, itemName: 'n', items: [part] }], [], lastDay)
    expect(rows).toHaveLength(1)
    expect(rows[0].remainingDays).toBe(0)
  })
  it('expires the day after', () => {
    const date = new Date(2026, 0, 10).getTime()
    expect(buildWarranties([{ id: 'h', date, itemName: 'n', items: [part] }], [], new Date(2026, 6, 11, 1).getTime())).toHaveLength(0)
  })
  it('ignores non-part and zero-month items', () => {
    const date = new Date(2026, 0, 10).getTime()
    const items = [{ ...part, kind: 'labor' as const }, { ...part, id: 'q', warrantyMonths: 0 }]
    expect(buildWarranties([{ id: 'h', date, itemName: 'n', items }], [], date)).toHaveLength(0)
  })
})

describe('ics', () => {
  it('escapes backslashes, commas, semicolons and newlines', () => {
    const ics = buildIcsReminder({ title: 'a\\b, c; d\ne', dueAt: new Date(2026, 5, 10).getTime() })
    expect(ics).toContain('SUMMARY:a' + '\\\\' + 'b' + '\\,' + ' c' + '\\;' + ' d' + '\\n' + 'e')
  })
  it('ends the all-day event on the next calendar date', () => {
    const ics = buildIcsReminder({ title: 't', dueAt: new Date(2026, 9, 25).getTime() })
    expect(ics).toContain('DTSTART;VALUE=DATE:20261025')
    expect(ics).toContain('DTEND;VALUE=DATE:20261026')
    const eom = buildIcsReminder({ title: 't', dueAt: new Date(2026, 11, 31).getTime() })
    expect(eom).toContain('DTEND;VALUE=DATE:20270101')
  })
})

describe('expenses csv', () => {
  it('neutralises formula-looking cells and quotes commas', () => {
    const csv = buildExpensesCsv(
      [
        {
          kind: 'expense',
          id: 'e',
          date: new Date(2026, 0, 1).getTime(),
          mileage: null,
          entry: { id: 'e', carId: 'c', category: 'other', title: '=HYPERLINK("x")', amount: 10, date: 0, note: 'a, b' },
        },
      ],
      '₽',
      () => undefined,
    )
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('"a, b"')
  })
})

describe('derived lists stay consistent', () => {
  it('cost structure shares always add up to 1 and parts list is newest first', () => {
    const hist = [
      { id: 'a', date: 1, itemName: 'A', cost: 100, items: [{ id: '1', kind: 'part' as const, name: 'p', amount: 70 }] },
      { id: 'b', date: 2, itemName: 'B', cost: 50, items: [{ id: '2', kind: 'labor' as const, name: 'l', amount: 10 }] },
    ]
    const rows = buildCostStructure([{ cost: 25 }], hist, [{ amount: 5, category: 'fine' }])
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1)
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(180)
    expect(buildPartsList(hist, []).map((r) => r.key)).toEqual(['b-2', 'a-1'])
  })
})

describe('ics calendar', () => {
  it('writes one timed event with an alarm per deadline, in local time', () => {
    const ics = buildIcsCalendar(
      [
        { uid: 'a', title: 'Ford: Масло', description: 'Скоро ТО', start: new Date(2026, 9, 5, 9, 0).getTime() },
        { uid: 'b', title: '≈ Ремень', start: new Date(2026, 10, 1, 14, 30).getTime() },
      ],
      new Date(2026, 5, 15),
    )
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART:20261005T090000')
    expect(ics).toContain('DTEND:20261005T093000')
    expect(ics).toContain('DTSTART:20261101T143000')
    expect(ics).toContain('UID:a@moya-mashina')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
  })

  it('folds long lines to 75 characters', () => {
    const ics = buildIcsCalendar([{ uid: 'a', title: 'ОЧЕНЬ длинное название '.repeat(8), start: 0 }])
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
    // Unfolding restores the original text.
    expect(ics.replace(/\r\n /g, '')).toContain('ОЧЕНЬ длинное название ОЧЕНЬ')
  })
})
