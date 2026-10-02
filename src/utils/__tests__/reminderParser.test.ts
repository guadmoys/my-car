import { describe, expect, it } from 'vitest'
import { parseReminderInput } from '../reminderParser'

describe('parseReminderInput', () => {
  it('rejects empty input', () => {
    expect(parseReminderInput('   ')).toBeNull()
  })

  it('parses relative mileage', () => {
    expect(parseReminderInput('через 300 км проверить масло')).toEqual({
      text: 'проверить масло',
      relativeKm: 300,
      hasTime: false,
    })
  })

  it('rejects zero km', () => {
    expect(parseReminderInput('через 0 км что-то')).toBeNull()
  })

  it('parses a date with the default 09:00 time', () => {
    const r = parseReminderInput('22.01.2030 техосмотр')
    expect(r?.text).toBe('техосмотр')
    expect(r?.hasTime).toBe(false)
    expect(r?.dueDate).toBe(new Date(2030, 0, 22, 9, 0).getTime())
  })

  it('parses a date with a time', () => {
    const r = parseReminderInput('01.02.2030 12:30 запись в сервис')
    expect(r?.hasTime).toBe(true)
    expect(r?.dueDate).toBe(new Date(2030, 1, 1, 12, 30).getTime())
  })

  it('rejects impossible dates and times', () => {
    expect(parseReminderInput('31.02.2030 что-то')).toBeNull()
    expect(parseReminderInput('01.02.2030 25:00 что-то')).toBeNull()
  })

  it('rejects text without a trigger', () => {
    expect(parseReminderInput('просто текст')).toBeNull()
  })
})
