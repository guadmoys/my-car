/**
 * Reader/writer for the CSV export format used by the third-party app
 * «Моя машина» (unrelated to this app, just a name collision) — three
 * semicolon-delimited sections (Заправки/Сервис/Детали) in one file, each
 * with its own header row and a trailing totals row.
 */
import type { FuelEntry, HistoryEntry } from '../types'

const SECTION_NAMES = ['Заправки', 'Сервис', 'Детали'] as const
type Section = (typeof SECTION_NAMES)[number]

function isSectionHeaderRow(row: string[]): Section | null {
  if (row.length !== 1) return null
  const name = row[0].trim()
  return (SECTION_NAMES as readonly string[]).includes(name) ? (name as Section) : null
}

/** RFC4180-ish tokenizer: ';' delimiter, '"' quoting (with embedded newlines/commas), doubled quotes escape a literal quote. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = text.length
  while (i < len) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ';') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += ch
    i++
  }
  row.push(field)
  rows.push(row)
  return rows
}

function parseRuDate(raw: string): number | undefined {
  const s = raw.trim()
  if (!s) return undefined
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!m) return undefined
  const [, d, mo, y, h, mi] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), h ? Number(h) : 0, mi ? Number(mi) : 0)
  const ts = date.getTime()
  return Number.isNaN(ts) ? undefined : ts
}

function formatRuDateTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseRuNumber(raw: string): number | undefined {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function csvField(value: string): string {
  return /["\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export interface ParsedFuelRow {
  date: number
  mileage: number
  fuelType?: string
  liters: number
  cost?: number
  station?: string
  comment?: string
  isFullTank: boolean
}

export interface ParsedServiceRow {
  date: number
  mileage: number
  serviceType?: string
  name: string
  workDetails?: string
  partsCost?: number
  laborCost?: number
  cost?: number
  location?: string
  comment?: string
}

export interface ParsedPartRow {
  date: number
  mileage: number
  category?: string
  name: string
  number?: string
  originalNumber?: string
  manufacturer?: string
  price?: number
  qty?: number
  cost?: number
  description?: string
  location?: string
  comment?: string
  wear?: string
  replacement?: string
  removed?: string
}

export interface ParsedCarCsv {
  fuel: ParsedFuelRow[]
  service: ParsedServiceRow[]
  /** Only rows that have both an install date and a mileage — a part still in stock (no install date) has nowhere to go in this app's data model. */
  parts: ParsedPartRow[]
  /** Count of "Детали" rows that were dropped because they aren't installed (no date/mileage). */
  skippedPartsCount: number
}

export function parseMoyaMashinaCsv(text: string): ParsedCarCsv {
  const clean = text.replace(/^﻿/, '')
  const rows = parseCsvRows(clean)
  const fuel: ParsedFuelRow[] = []
  const service: ParsedServiceRow[] = []
  const parts: ParsedPartRow[] = []
  let skippedPartsCount = 0

  let section: Section | null = null
  let i = 0
  while (i < rows.length) {
    const row = rows[i]
    const header = isSectionHeaderRow(row)
    if (header) {
      section = header
      i += 2 // skip the section-name row and the column-header row right after it
      continue
    }
    if (!section) {
      i++
      continue
    }

    const cell = (idx: number) => (row[idx] ?? '').trim()

    if (section === 'Заправки') {
      const dateRaw = cell(0)
      if (dateRaw) {
        const date = parseRuDate(dateRaw)
        const mileage = parseRuNumber(cell(1))
        const liters = parseRuNumber(cell(3))
        if (date !== undefined && mileage !== undefined && liters !== undefined) {
          fuel.push({
            date,
            mileage,
            fuelType: cell(2) || undefined,
            liters,
            cost: parseRuNumber(cell(5)),
            station: cell(6) || undefined,
            comment: cell(7) || undefined,
            isFullTank: /^да$/i.test(cell(8)),
          })
        }
      }
    } else if (section === 'Сервис') {
      const dateRaw = cell(0)
      if (dateRaw) {
        const date = parseRuDate(dateRaw)
        const mileage = parseRuNumber(cell(1))
        const name = cell(3)
        if (date !== undefined && mileage !== undefined && name) {
          const partsCost = parseRuNumber(cell(5))
          const laborCost = parseRuNumber(cell(6))
          service.push({
            date,
            mileage,
            serviceType: cell(2) || undefined,
            name,
            workDetails: cell(4) || undefined,
            partsCost,
            laborCost,
            cost: parseRuNumber(cell(7)) ?? (partsCost !== undefined || laborCost !== undefined ? (partsCost ?? 0) + (laborCost ?? 0) : undefined),
            location: cell(8) || undefined,
            comment: cell(9) || undefined,
          })
        }
      }
    } else if (section === 'Детали') {
      const allEmpty = row.every((c) => !c.trim())
      if (!allEmpty) {
        const name = cell(3)
        if (name) {
          const date = parseRuDate(cell(0))
          const mileage = parseRuNumber(cell(1))
          const price = parseRuNumber(cell(7))
          const qty = parseRuNumber(cell(8))
          if (date !== undefined && mileage !== undefined) {
            parts.push({
              date,
              mileage,
              category: cell(2) || undefined,
              name,
              number: cell(4) || undefined,
              originalNumber: cell(5) || undefined,
              manufacturer: cell(6) || undefined,
              price,
              qty,
              cost: parseRuNumber(cell(9)) ?? (price !== undefined && qty !== undefined ? price * qty : price),
              description: cell(10) || undefined,
              location: cell(11) || undefined,
              comment: cell(12) || undefined,
              wear: cell(13) || undefined,
              replacement: cell(14) || undefined,
              removed: cell(15) || undefined,
            })
          } else {
            skippedPartsCount++
          }
        }
      }
    }
    i++
  }

  return { fuel, service, parts, skippedPartsCount }
}

function noteLine(lines: string[], label: string, value: string | undefined) {
  if (value && value.trim()) lines.push(`${label}: ${value.trim()}`)
}

/** Folds the CSV fields this app has no dedicated column for into one free-text note. */
export function composeServiceNote(row: ParsedServiceRow): string | undefined {
  const lines: string[] = []
  noteLine(lines, 'Вид сервиса', row.serviceType)
  noteLine(lines, 'Место', row.location)
  if (row.partsCost !== undefined || row.laborCost !== undefined) {
    lines.push(`Детали/работа: ${row.partsCost ?? 0} ₽ / ${row.laborCost ?? 0} ₽`)
  }
  noteLine(lines, 'Работы', row.workDetails)
  noteLine(lines, 'Комментарий', row.comment)
  return lines.length ? lines.join('\n') : undefined
}

/** Same idea, for an installed part imported from the «Детали» section. */
export function composePartNote(row: ParsedPartRow): string | undefined {
  const lines: string[] = []
  noteLine(lines, 'Категория', row.category)
  noteLine(lines, 'Артикул', row.number)
  noteLine(lines, 'Оригинальный номер', row.originalNumber)
  noteLine(lines, 'Производитель', row.manufacturer)
  if (row.qty !== undefined) lines.push(`Кол-во: ${row.qty}`)
  if (row.price !== undefined) lines.push(`Цена за ед.: ${row.price} ₽`)
  noteLine(lines, 'Место', row.location)
  noteLine(lines, 'Износ', row.wear)
  noteLine(lines, 'Замена', row.replacement)
  noteLine(lines, 'Снято', row.removed)
  noteLine(lines, 'Описание', row.description)
  noteLine(lines, 'Комментарий', row.comment)
  return lines.length ? lines.join('\n') : undefined
}

function totalRow(colCount: number, sumIndex: number, value: number): string {
  const cells = new Array(colCount).fill('')
  if (value) cells[sumIndex] = String(Math.round(value * 100) / 100)
  return cells.join(';')
}

/** Builds the same 3-section format back out of this app's own data, for round-tripping/backup with «Моя машина». */
export function buildMoyaMashinaCsv(input: { fuel: FuelEntry[]; history: HistoryEntry[] }): string {
  const lines: string[] = []

  lines.push('Заправки')
  lines.push(['Дата', 'Пробег', 'Вид топлива', 'Количество', 'Цена', 'Сумма', 'АЗС', 'Комментарий', 'Полный бак'].join(';'))
  const fuelSorted = input.fuel.slice().sort((a, b) => b.date - a.date)
  let fuelTotal = 0
  for (const e of fuelSorted) {
    const price = e.cost !== undefined && e.liters > 0 ? (e.cost / e.liters).toFixed(2) : ''
    if (e.cost !== undefined) fuelTotal += e.cost
    lines.push(
      [
        formatRuDateTime(e.date),
        String(e.mileage),
        csvField(e.fuelType ?? ''),
        String(e.liters),
        price,
        e.cost !== undefined ? String(e.cost) : '',
        csvField(e.station ?? ''),
        csvField(e.comment ?? ''),
        e.isFullTank === false ? '' : 'Да',
      ].join(';'),
    )
  }
  lines.push(totalRow(9, 5, fuelTotal))
  lines.push('')

  lines.push('Сервис')
  lines.push(
    ['Дата', 'Пробег', 'Вид сервиса', 'Название', 'Виды работ и детали', 'Стоимость деталей', 'Стоимость работ', 'Сумма', 'Место', 'Комментарий'].join(
      ';',
    ),
  )
  const historySorted = input.history.slice().sort((a, b) => b.date - a.date)
  let serviceTotal = 0
  for (const h of historySorted) {
    if (h.cost !== undefined) serviceTotal += h.cost
    lines.push(
      [
        formatRuDateTime(h.date),
        String(h.mileage),
        '',
        csvField(h.itemName),
        '',
        '',
        '',
        h.cost !== undefined ? String(h.cost) : '',
        '',
        csvField(h.note ?? ''),
      ].join(';'),
    )
  }
  lines.push(totalRow(10, 7, serviceTotal))
  lines.push('')

  lines.push('Детали')
  lines.push(
    [
      'Дата установки',
      'Пробег',
      'Категория',
      'Название',
      'Номер',
      'Оригинальный номер',
      'Производитель',
      'Цена',
      'Кол-во',
      'Сумма',
      'Описание',
      'Место',
      'Комментарий',
      'Износ',
      'Замена',
      'Снято',
    ].join(';'),
  )

  return lines.join('\n')
}
