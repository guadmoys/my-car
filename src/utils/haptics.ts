type Pattern = 'tap' | 'success' | 'warning' | 'delete'

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  success: [12, 40, 16],
  warning: 20,
  delete: [10, 30, 10, 30, 20],
}

export function haptic(pattern: Pattern = 'tap'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  navigator.vibrate(PATTERNS[pattern])
}
