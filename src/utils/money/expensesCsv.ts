import { EXPENSE_CATEGORY_LABELS, EXPENSE_ITEM_KIND_LABELS } from '../../types'
import type { ExpenseItem, TimelineEvent } from '../../types'

function esc(raw: string): string {
  // A cell starting with = + - @ would run as a formula when opened in Excel/Sheets.
  const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return /["\n,;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function sumKind(items: ExpenseItem[] | undefined, kind: ExpenseItem['kind']): number {
  return (items ?? []).filter((i) => i.kind === kind).reduce((s, i) => s + i.amount, 0)
}

/** All spending (fuel, service, other) as CSV, oldest first, with the parts/labor breakdown in columns. */
export function buildExpensesCsv(events: TimelineEvent[], currency: string, masterName: (id: string) => string | undefined): string {
  const header = ['Дата', 'Тип', 'Название', 'Категория', `Сумма, ${currency}`, `Детали, ${currency}`, `Работа, ${currency}`, `Другое, ${currency}`, 'Состав', 'Мастер', 'Заметка']
  const lines = [header.join(',')]
  for (const e of [...events].sort((a, b) => a.date - b.date)) {
    let type: string
    let title: string
    let category = ''
    let total: number | undefined
    let items: ExpenseItem[] | undefined
    let master = ''
    let note = ''
    if (e.kind === 'fuel') {
      type = 'Заправка'
      title = `${e.entry.liters} л${e.entry.station ? ` · ${e.entry.station}` : ''}`
      total = e.entry.cost
      note = e.entry.comment ?? ''
    } else if (e.kind === 'service') {
      type = 'ТО'
      title = e.entry.itemName
      total = e.entry.cost
      items = e.entry.items
      master = (e.entry.masterId && masterName(e.entry.masterId)) || ''
      note = e.entry.note ?? ''
    } else {
      type = 'Прочее'
      title = e.entry.title ?? EXPENSE_CATEGORY_LABELS[e.entry.category]
      category = EXPENSE_CATEGORY_LABELS[e.entry.category]
      total = e.entry.amount
      items = e.entry.items
      master = (e.entry.masterId && masterName(e.entry.masterId)) || ''
      note = e.entry.note ?? ''
    }
    const detail = (items ?? []).map((i) => `${EXPENSE_ITEM_KIND_LABELS[i.kind]}: ${i.name || '—'} ${i.amount}`).join('; ')
    lines.push(
      [
        new Date(e.date).toLocaleDateString('ru-RU'),
        type,
        esc(title),
        esc(category),
        total !== undefined ? String(total) : '',
        items?.length ? String(sumKind(items, 'part')) : '',
        items?.length ? String(sumKind(items, 'labor')) : '',
        items?.length ? String(sumKind(items, 'other')) : '',
        esc(detail),
        esc(master),
        esc(note),
      ].join(','),
    )
  }
  return '﻿' + lines.join('\n')
}
