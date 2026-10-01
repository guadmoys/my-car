import { ref } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

export const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

const STORAGE_KEY = 'my-car-theme'

function load(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEME_OPTIONS.some((o) => o.value === stored) ? (stored as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

const mode = ref<ThemeMode>(load())
const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

function isDark(): boolean {
  if (mode.value === 'system') return query?.matches ?? false
  return mode.value === 'dark'
}

function apply() {
  const dark = isDark()
  document.documentElement.classList.toggle('ion-palette-dark', dark)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = dark ? '#000000' : '#F2F2F7'
  document.head.appendChild(meta)
}

/** Applies the saved theme and keeps "Авто" in sync with the OS setting. Call once at startup, before mounting. */
export function initTheme(): void {
  apply()
  query?.addEventListener?.('change', () => {
    if (mode.value === 'system') apply()
  })
}

export function getThemeMode(): ThemeMode {
  return mode.value
}

export function setThemeMode(value: ThemeMode): void {
  mode.value = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* best effort */
  }
  apply()
}
