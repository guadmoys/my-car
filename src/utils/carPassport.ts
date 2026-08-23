import type { Car, HistoryEntry } from '../types'
import { formatDate } from './dateFormat'

export interface PassportData {
  car: Car
  okCount: number
  soonCount: number
  dueCount: number
  averageConsumption: number | null
  totalFuelCost: number
  totalServiceCost: number
  totalCost: number
  hasAnyCost: boolean
  recentHistory: HistoryEntry[]
}

const COLOR = {
  blue: '#0a84ff',
  blueDark: '#0040dd',
  green: '#30d158',
  orange: '#ff9f0a',
  red: '#ff453a',
  page: '#f2f2f7',
  card: '#ffffff',
  text: '#1c1c1e',
  textSecondary: 'rgba(60, 60, 67, 0.6)',
  textTertiary: 'rgba(60, 60, 67, 0.3)',
  separator: 'rgba(60, 60, 67, 0.12)',
}

const WIDTH = 1000
const MARGIN = 32
const CARD_X = MARGIN
const CARD_W = WIDTH - MARGIN * 2
const PAD = 36
const HEADER_H = 270
const HISTORY_ROWS = 5
const HISTORY_ROW_H = 58

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

function fmtCost(n: number): string {
  return `${fmtNum(n)} ₽`
}

/**
 * Card height depends only on which optional sections are present and how many
 * history rows are drawn — never on text length (all text is truncated to fit),
 * so the height can be computed up front without a canvas.
 */
function computeCardHeight(data: PassportData): number {
  let h = HEADER_H + PAD // body top padding
  if (data.hasAnyCost) h += 20 + 14 + 74 + 28 // title + gap + stat row + section gap
  h += 20 + 14 // history title + gap
  h += (data.recentHistory.length > 0 ? Math.min(data.recentHistory.length, HISTORY_ROWS) : 1) * HISTORY_ROW_H
  h += 28 // gap before footer
  h += 1 + 20 + 24 // separator + gap + footer text row
  h += PAD // body bottom padding
  return h
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  dotColor: string | null,
): number {
  ctx.font = '600 15px -apple-system, system-ui, sans-serif'
  const textW = ctx.measureText(text).width
  const dotW = dotColor ? 14 : 0
  const chipW = 24 + dotW + textW
  const chipH = 34
  roundRectPath(ctx, x, y, chipW, chipH, chipH / 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.fill()
  let cursor = x + 14
  if (dotColor) {
    ctx.beginPath()
    ctx.arc(cursor + 4, y + chipH / 2, 4, 0, Math.PI * 2)
    ctx.fillStyle = dotColor
    ctx.fill()
    cursor += 14
  }
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cursor, y + chipH / 2 + 1)
  return chipW
}

function draw(ctx: CanvasRenderingContext2D, data: PassportData, cardH: number) {
  const { car } = data
  const totalH = cardH + MARGIN * 2

  ctx.fillStyle = COLOR.page
  ctx.fillRect(0, 0, WIDTH, totalH)

  roundRectPath(ctx, CARD_X, MARGIN, CARD_W, cardH, 28)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  ctx.fillStyle = COLOR.card
  ctx.fill()
  ctx.restore()

  roundRectPath(ctx, CARD_X, MARGIN, CARD_W, cardH, 28)
  ctx.clip()

  // Header
  const gradient = ctx.createLinearGradient(CARD_X, MARGIN, CARD_X + CARD_W, MARGIN + HEADER_H)
  gradient.addColorStop(0, COLOR.blue)
  gradient.addColorStop(1, COLOR.blueDark)
  ctx.fillStyle = gradient
  ctx.fillRect(CARD_X, MARGIN, CARD_W, HEADER_H)

  let y = MARGIN + PAD
  const x = CARD_X + PAD

  // Identity: avatar + make/model/year
  ctx.beginPath()
  ctx.arc(x + 26, y + 26, 26, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 22px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(car.make.charAt(0).toUpperCase(), x + 26, y + 27)
  ctx.textAlign = 'left'

  ctx.font = '600 17px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fillText(
    truncate(ctx, `${car.year} · ${car.make} ${car.model}`, CARD_W - PAD * 2 - 68),
    x + 68,
    y + 27,
  )

  y += 78
  ctx.font = '500 15px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Текущий пробег', x, y)

  y += 46
  ctx.font = '700 48px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = '#ffffff'
  const mileageText = fmtNum(car.currentMileage)
  ctx.fillText(mileageText, x, y)
  const mileageWidth = ctx.measureText(mileageText).width
  ctx.font = '500 20px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillText('км', x + mileageWidth + 14, y)

  y += 40
  let chipX = x
  ctx.textBaseline = 'middle'
  chipX += drawChip(ctx, chipX, y, `${data.okCount} ок`, COLOR.green) + 10
  if (data.soonCount > 0) chipX += drawChip(ctx, chipX, y, `${data.soonCount} скоро`, COLOR.orange) + 10
  if (data.dueCount > 0) chipX += drawChip(ctx, chipX, y, `${data.dueCount} просрочено`, COLOR.red) + 10
  if (data.averageConsumption !== null) {
    drawChip(ctx, chipX, y, `⛽ ${data.averageConsumption.toFixed(1)} л/100км`, null)
  }

  // Body
  let by = MARGIN + HEADER_H + PAD
  const bx = CARD_X + PAD
  const bw = CARD_W - PAD * 2

  if (data.hasAnyCost) {
    ctx.font = '700 13px -apple-system, system-ui, sans-serif'
    ctx.fillStyle = COLOR.textSecondary
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('РАСХОДЫ', bx, by + 13)
    by += 20 + 14

    const cols = [
      { label: 'Топливо', value: fmtCost(data.totalFuelCost) },
      { label: 'ТО', value: fmtCost(data.totalServiceCost) },
      { label: 'Итого', value: fmtCost(data.totalCost) },
    ]
    const colW = bw / 3
    cols.forEach((col, i) => {
      const cx = bx + colW * i
      ctx.font = '700 22px -apple-system, system-ui, sans-serif'
      ctx.fillStyle = i === 2 ? COLOR.blue : COLOR.text
      ctx.fillText(truncate(ctx, col.value, colW - 16), cx, by + 26)
      ctx.font = '500 13px -apple-system, system-ui, sans-serif'
      ctx.fillStyle = COLOR.textSecondary
      ctx.fillText(col.label, cx, by + 48)
      if (i > 0) {
        ctx.strokeStyle = COLOR.separator
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx - 16, by)
        ctx.lineTo(cx - 16, by + 56)
        ctx.stroke()
      }
    })
    by += 74 + 28
  }

  ctx.font = '700 13px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = COLOR.textSecondary
  ctx.fillText('ПОСЛЕДНЕЕ ТО', bx, by + 13)
  by += 20 + 14

  if (data.recentHistory.length === 0) {
    ctx.font = '500 15px -apple-system, system-ui, sans-serif'
    ctx.fillStyle = COLOR.textTertiary
    ctx.fillText('Пока нет записей', bx, by + 24)
    by += HISTORY_ROW_H
  } else {
    const rows = data.recentHistory.slice(0, HISTORY_ROWS)
    rows.forEach((entry, i) => {
      const ry = by + i * HISTORY_ROW_H
      ctx.font = '500 16px -apple-system, system-ui, sans-serif'
      ctx.fillStyle = COLOR.text
      ctx.fillText(truncate(ctx, entry.itemName, bw * 0.55), bx, ry + 24)

      ctx.font = '500 14px -apple-system, system-ui, sans-serif'
      ctx.fillStyle = COLOR.textSecondary
      ctx.textAlign = 'right'
      ctx.fillText(`${fmtNum(entry.mileage)} км · ${formatDate(entry.date)}`, bx + bw, ry + 24)
      ctx.textAlign = 'left'

      if (i < rows.length - 1) {
        ctx.strokeStyle = COLOR.separator
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(bx, ry + 40)
        ctx.lineTo(bx + bw, ry + 40)
        ctx.stroke()
      }
    })
    by += rows.length * HISTORY_ROW_H
  }
  by += 28

  ctx.strokeStyle = COLOR.separator
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx + bw, by)
  ctx.stroke()
  by += 20

  ctx.font = '700 13px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = COLOR.textSecondary
  ctx.fillText('🚗 Моя машина', bx, by + 13)
  ctx.font = '500 12px -apple-system, system-ui, sans-serif'
  ctx.fillStyle = COLOR.textTertiary
  ctx.textAlign = 'right'
  ctx.fillText(`Сформировано ${formatDate(Date.now())}`, bx + bw, by + 13)
  ctx.textAlign = 'left'
}

export async function generatePassportImage(data: PassportData): Promise<Blob> {
  const cardH = computeCardHeight(data)
  const totalH = cardH + MARGIN * 2
  const dpr = 2

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * dpr
  canvas.height = totalH * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.scale(dpr, dpr)

  draw(ctx, data, cardH)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Не удалось создать изображение'))
    }, 'image/png')
  })
}
