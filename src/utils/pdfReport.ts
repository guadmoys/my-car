import { jsPDF } from 'jspdf'
import { EXPENSE_CATEGORY_LABELS } from '../types'
import type { Car, Expense, HistoryEntry, MaintenanceStatus, Trip } from '../types'

export interface ReportData {
  car: Car
  statuses: MaintenanceStatus[]
  totalFuelCost: number
  totalServiceCost: number
  totalExpensesCost: number
  totalCost: number
  expenses: Expense[]
  trips: Trip[]
  totalBusinessKm: number
  totalPersonalKm: number
  recentHistory: HistoryEntry[]
}

// Renders the report as a canvas (same technique as carPassport.ts) rather
// than through jsPDF's own text APIs: jsPDF's built-in fonts have no
// Cyrillic glyphs, and embedding a font just for this would add real bundle
// weight. Canvas text goes through the browser's own font stack, so Russian
// renders correctly for free — jsPDF then only has to place that image on a
// page and trigger the download.

const COLOR = {
  blue: '#0a84ff',
  blueDark: '#0040dd',
  page: '#f2f2f7',
  card: '#ffffff',
  text: '#1c1c1e',
  textSecondary: 'rgba(60, 60, 67, 0.6)',
  textTertiary: 'rgba(60, 60, 67, 0.3)',
  separator: 'rgba(60, 60, 67, 0.12)',
  danger: '#ff453a',
  warning: '#ff9f0a',
}

const WIDTH = 900
const MARGIN = 28
const PAD = 32
const ROW_H = 30
const SECTION_GAP = 22

function fmtCost(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

function fmtKm(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} км`
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

interface Section {
  title: string
  rows: { text: string; note?: string; color?: string }[]
  emptyText?: string
}

function buildSections(data: ReportData): Section[] {
  const sections: Section[] = []

  sections.push({
    title: 'РАСХОДЫ',
    rows: [
      { text: 'Топливо', note: fmtCost(data.totalFuelCost) },
      { text: 'ТО', note: fmtCost(data.totalServiceCost) },
      { text: 'Прочее', note: fmtCost(data.totalExpensesCost) },
      { text: 'Итого', note: fmtCost(data.totalCost), color: COLOR.blue },
    ],
  })

  const attention = data.statuses.filter((s) => s.state !== 'ok').slice(0, 10)
  sections.push({
    title: 'ТРЕБУЕТ ВНИМАНИЯ (ТО)',
    rows: attention.map((s) => ({
      text: s.item.name,
      note: s.state === 'due' ? 'Просрочено' : 'Скоро',
      color: s.state === 'due' ? COLOR.danger : COLOR.warning,
    })),
    emptyText: 'Всё в порядке',
  })

  if (data.expenses.length > 0) {
    sections.push({
      title: 'ПРОЧИЕ РАСХОДЫ',
      rows: data.expenses
        .slice(0, 10)
        .map((e) => ({ text: `${fmtDate(e.date)} · ${e.title || EXPENSE_CATEGORY_LABELS[e.category]}`, note: fmtCost(e.amount) })),
    })
  }

  if (data.trips.length > 0) {
    sections.push({
      title: 'УЧЁТ ПРОБЕГА (НАЛОГОВЫЙ)',
      rows: [
        { text: 'Деловые поездки', note: fmtKm(data.totalBusinessKm) },
        { text: 'Личные поездки', note: fmtKm(data.totalPersonalKm) },
        ...data.trips
          .slice(0, 8)
          .map((t) => ({
            text: `${fmtDate(t.date)} · ${t.purpose === 'business' ? 'деловая' : 'личная'}${t.note ? ` · ${t.note}` : ''}`,
            note: fmtKm(Math.max(0, t.endMileage - t.startMileage)),
          })),
      ],
    })
  }

  if (data.recentHistory.length > 0) {
    sections.push({
      title: 'ПОСЛЕДНЕЕ ТО',
      rows: data.recentHistory.slice(0, 10).map((h) => ({
        text: `${fmtDate(h.date)} · ${h.itemName}`,
        note: h.cost !== undefined ? fmtCost(h.cost) : undefined,
      })),
    })
  }

  return sections
}

function computeHeight(sections: Section[]): number {
  let h = 150 + PAD // header block + body top padding
  for (const section of sections) {
    h += 20 + 14 // section title + gap
    const rowCount = section.rows.length > 0 ? section.rows.length : 1
    h += rowCount * ROW_H
    h += SECTION_GAP
  }
  h += PAD
  return h
}

function draw(ctx: CanvasRenderingContext2D, data: ReportData, cardH: number) {
  const { car } = data
  const totalH = cardH + MARGIN * 2
  const cardW = WIDTH - MARGIN * 2

  ctx.fillStyle = COLOR.page
  ctx.fillRect(0, 0, WIDTH, totalH)
  ctx.fillStyle = COLOR.card
  ctx.fillRect(MARGIN, MARGIN, cardW, cardH)

  // Header
  const gradient = ctx.createLinearGradient(MARGIN, MARGIN, MARGIN + cardW, MARGIN + 150)
  gradient.addColorStop(0, COLOR.blue)
  gradient.addColorStop(1, COLOR.blueDark)
  ctx.fillStyle = gradient
  ctx.fillRect(MARGIN, MARGIN, cardW, 150)

  const x = MARGIN + PAD
  let y = MARGIN + 44
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 26px -apple-system, system-ui, sans-serif'
  ctx.fillText(truncate(ctx, `${car.year} · ${car.make} ${car.model}`, cardW - PAD * 2), x, y)

  y += 30
  ctx.font = '500 15px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  const idParts = [fmtKm(car.currentMileage)]
  if (car.licensePlate) idParts.push(car.licensePlate)
  if (car.vin) idParts.push(`VIN ${car.vin}`)
  ctx.fillText(truncate(ctx, idParts.join(' · '), cardW - PAD * 2), x, y)

  y += 26
  ctx.font = '500 13px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillText(`Отчёт сформирован ${fmtDate(Date.now())}`, x, y)

  // Body
  let by = MARGIN + 150 + PAD
  const bx = MARGIN + PAD
  const bw = cardW - PAD * 2

  for (const section of buildSections(data)) {
    ctx.font = '700 13px -apple-system, system-ui, sans-serif'
    ctx.fillStyle = COLOR.textSecondary
    ctx.fillText(section.title, bx, by + 13)
    by += 20 + 14

    if (section.rows.length === 0) {
      ctx.font = '500 15px -apple-system, system-ui, sans-serif'
      ctx.fillStyle = COLOR.textTertiary
      ctx.fillText(section.emptyText ?? 'Нет данных', bx, by + 20)
      by += ROW_H
    } else {
      section.rows.forEach((row, i) => {
        const ry = by + i * ROW_H
        ctx.font = '500 15px -apple-system, system-ui, sans-serif'
        ctx.fillStyle = COLOR.text
        ctx.fillText(truncate(ctx, row.text, bw * 0.62), bx, ry + 20)

        if (row.note) {
          ctx.font = '600 15px -apple-system, system-ui, sans-serif'
          ctx.fillStyle = row.color ?? COLOR.textSecondary
          ctx.textAlign = 'right'
          ctx.fillText(row.note, bx + bw, ry + 20)
          ctx.textAlign = 'left'
        }

        if (i < section.rows.length - 1) {
          ctx.strokeStyle = COLOR.separator
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(bx, ry + ROW_H - 6)
          ctx.lineTo(bx + bw, ry + ROW_H - 6)
          ctx.stroke()
        }
      })
      by += section.rows.length * ROW_H
    }
    by += SECTION_GAP
  }
}

/**
 * Builds a one-page PDF summary report (car info, cost totals, maintenance
 * due list, other-expenses list, business/personal mileage split, recent
 * service history) and triggers a download.
 */
export function generateReportPdf(data: ReportData): void {
  const sections = buildSections(data)
  const cardH = computeHeight(sections)
  const totalH = cardH + MARGIN * 2
  const dpr = 2

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * dpr
  canvas.height = totalH * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.scale(dpr, dpr)
  draw(ctx, data, cardH)

  const imgData = canvas.toDataURL('image/png')
  // Page sized to exactly match the rendered content (in points, 1px = 0.75pt
  // at 96dpi) — a custom-sized single-page PDF, rather than fitting the
  // report into a fixed A4 frame with pagination logic.
  const doc = new jsPDF({ unit: 'pt', format: [WIDTH * 0.75, totalH * 0.75] })
  doc.addImage(imgData, 'PNG', 0, 0, WIDTH * 0.75, totalH * 0.75)

  const dateStr = new Date().toISOString().slice(0, 10)
  doc.save(`otchyot-${data.car.make}-${data.car.model}-${dateStr}.pdf`.toLowerCase().replace(/\s+/g, '-'))
}
