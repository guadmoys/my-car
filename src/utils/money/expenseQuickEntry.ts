import type { ExpenseCategory } from '../../types'

export interface ParsedExpenseEntry {
  amount?: number
  category?: ExpenseCategory
  title?: string
}

// Stems, matched at the start of a word so "штрафы"/"штрафа" both hit "штраф" (but "авто" never hits "то").
const CATEGORY_STEMS: [ExpenseCategory, string[]][] = [
  ['insurance', ['осаго', 'каско', 'страхов']],
  ['fine', ['штраф', 'гибдд']],
  ['parking', ['парковк', 'платн', 'стоянк', 'эвакуатор']],
  ['tax', ['налог', 'техосмотр']],
  ['loan', ['кредит', 'лизинг', 'рассрочк', 'ипотек']],
  ['damage', ['ущерб', 'дтп', 'ремонт', 'бампер', 'царапин', 'вмятин', 'покраск', 'стекл']],
]

/**
 * Parses free text such as "осаго 12 000", "штраф 500р" or "ремонт бампера 45к"
 * into amount / category / leftover title. Every part is optional.
 */
export function parseExpenseQuickEntry(input: string): ParsedExpenseEntry {
  const text = input.trim()
  if (!text) return {}
  const result: ParsedExpenseEntry = {}

  // "12 000", "12000", "1 200,50", optionally with к/тыс/р/руб/₽ right after.
  const re = /(\d{1,3}(?:[\s ]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(к|k|тыс\.?|тысяч|р\.?|руб\.?|₽)?(?![\p{L}\d])/giu
  let best: { value: number; start: number; end: number } | null = null
  for (const m of text.matchAll(re)) {
    let value = Number(`${m[1].replace(/[\s ]/g, '')}${m[2] ? `.${m[2]}` : ''}`)
    const suffix = (m[3] ?? '').toLowerCase()
    if (suffix === 'к' || suffix === 'k' || suffix.startsWith('тыс')) value *= 1000
    if (!Number.isFinite(value) || value <= 0) continue
    // Prefer the biggest number: "ремонт 2 бампера 45000" should pick 45000.
    if (!best || value > best.value) best = { value, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }
  }
  if (best) result.amount = best.value

  for (const [category, stems] of CATEGORY_STEMS) {
    if (stems.some((stem) => new RegExp(`(^|[^\\p{L}])${stem}`, 'iu').test(text))) {
      result.category = category
      break
    }
  }

  const rest = best ? `${text.slice(0, best.start)} ${text.slice(best.end)}` : text
  const title = rest.replace(/\s+/g, ' ').replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, '')
  if (title) result.title = title.charAt(0).toUpperCase() + title.slice(1)
  return result
}
