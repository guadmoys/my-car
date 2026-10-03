/** Saves text as a file through a temporary link click (the browser's own download). */
export function downloadTextFile(fileName: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const todayStamp = (): string => new Date().toISOString().slice(0, 10)
