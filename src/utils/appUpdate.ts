import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

export type UpdateCheckResult = 'updated' | 'up-to-date' | 'offline' | 'unavailable'

/** True while a new service-worker version is installing; App.vue shows the update screen. */
export const isUpdating = ref(false)

/** Safety net: if the reload never comes (e.g. install failed), give the UI back. */
const UPDATE_TIMEOUT_MS = 20_000

function beginUpdate(): void {
  if (isUpdating.value) return
  isUpdating.value = true
  setTimeout(() => {
    isUpdating.value = false
  }, UPDATE_TIMEOUT_MS)
}

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
      // Only an *update* (an SW already controlling the page) — not the very first install.
      reg.addEventListener('updatefound', () => {
        if (navigator.serviceWorker.controller) beginUpdate()
      })
      // Check right at startup; with `autoUpdate` the new SW activates and the page reloads itself.
      void checkForUpdate()
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
  if (registration.installing) {
    if (navigator.serviceWorker.controller) beginUpdate()
    return 'updated'
  }

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
