import { registerSW } from 'virtual:pwa-register'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

export type UpdateCheckResult = 'updated' | 'up-to-date' | 'offline' | 'unavailable'

let swUrl: string | null = null
let registration: ServiceWorkerRegistration | undefined

/** Registers the service worker and starts periodically re-fetching it in the background. */
export function initAppUpdate(): void {
  if (!('serviceWorker' in navigator)) return

  registerSW({
    immediate: true,
    onRegisteredSW(url, reg) {
      swUrl = url
      registration = reg
      if (!reg) return
      setInterval(() => checkForUpdate(), CHECK_INTERVAL_MS)
    },
  })
}

/**
 * Forces the browser to re-fetch the service worker script now (bypassing HTTP
 * cache). If it changed, the SW registration updates and `registerType:
 * 'autoUpdate'` takes it from there — installs, activates, and reloads the app.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!registration || !swUrl) return 'unavailable'
  if (!navigator.onLine) return 'offline'
  if (registration.installing) return 'updated'

  try {
    const resp = await fetch(swUrl, {
      cache: 'no-store',
      headers: { cache: 'no-store', 'cache-control': 'no-cache' },
    })
    if (resp.status !== 200) return 'unavailable'
    await registration.update()
    return registration.waiting || registration.installing ? 'updated' : 'up-to-date'
  } catch {
    return 'unavailable'
  }
}
