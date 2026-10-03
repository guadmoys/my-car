export interface ParsedReceipt {
  amount?: number
  /** Timestamp at local midnight of the receipt date. */
  date?: number
}

function toNumber(raw: string): number {
  return Number(raw.replace(/[\s ]/g, '').replace(',', '.'))
}

/**
 * Pulls the total and date out of OCR'd receipt text. Looks for a number next
 * to ИТОГО/СУММА/К ОПЛАТЕ first, then falls back to the largest amount with
 * kopecks; the date is the first dd.mm.yy(yy) that is a real, non-future date.
 */
export function parseReceiptText(text: string, now = Date.now()): ParsedReceipt {
  const result: ParsedReceipt = {}
  const money = '(\\d{1,3}(?:[ \\u00a0]\\d{3})+|\\d+)[.,](\\d{2})'

  const labelled = new RegExp(`(?:итого|к оплате|сумма|всего)[^\\d\\n]{0,25}${money}`, 'giu')
  const labelledValues = [...text.matchAll(labelled)].map((m) => toNumber(`${m[1]}.${m[2]}`)).filter((n) => n > 0)
  if (labelledValues.length > 0) {
    result.amount = Math.max(...labelledValues)
  } else {
    const all = [...text.matchAll(new RegExp(money, 'g'))].map((m) => toNumber(`${m[1]}.${m[2]}`)).filter((n) => n > 0)
    if (all.length > 0) result.amount = Math.max(...all)
  }

  for (const m of text.matchAll(/(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/g)) {
    const day = Number(m[1])
    const month = Number(m[2])
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const d = new Date(year, month - 1, day)
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day && d.getTime() <= now) {
      result.date = d.getTime()
      break
    }
  }
  return result
}
