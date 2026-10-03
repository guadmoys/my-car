/** "Октябрь 2026" — month name capitalised, year without the trailing "г.". */
export function monthLabel(ts: number): string {
  const d = new Date(ts)
  const name = d.toLocaleDateString('ru-RU', { month: 'long' })
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${d.getFullYear()}`
}
