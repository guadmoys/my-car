import { reactive, watch } from 'vue'
import { useCarStore } from './useCarStore'
import { useToast } from './useToast'
import { haptic } from '../utils/haptics'
import * as cloud from '../utils/cloudSync'
import type { CloudAccount, CloudProvider, CloudSyncRecord } from '../utils/cloudSync'

const SYNC_DEBOUNCE_MS = 5000

const state = reactive({
  activeProvider: cloud.getActiveProvider(),
  autoSync: cloud.isAutoSyncEnabled(),
  syncing: false,
  error: null as string | null,
  accounts: {
    google: cloud.getConnectedAccount('google'),
    yandex: cloud.getConnectedAccount('yandex'),
  } as Record<CloudProvider, CloudAccount | null>,
  lastSync: {
    google: cloud.getLastSync('google'),
    yandex: cloud.getLastSync('yandex'),
  } as Record<CloudProvider, CloudSyncRecord | null>,
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let watcherStarted = false
let bootPromise: Promise<void> | null = null

function refreshFromStorage(): void {
  state.activeProvider = cloud.getActiveProvider()
  state.accounts.google = cloud.getConnectedAccount('google')
  state.accounts.yandex = cloud.getConnectedAccount('yandex')
  state.lastSync.google = cloud.getLastSync('google')
  state.lastSync.yandex = cloud.getLastSync('yandex')
}

function authErrorMessage(provider: CloudProvider): string {
  return provider === 'google'
    ? 'Сессия Google Диска истекла — войдите заново'
    : 'Сессия Яндекс.Диска истекла — войдите заново'
}

async function syncNow(showToast = true): Promise<void> {
  const provider = state.activeProvider
  if (!provider) return
  const store = useCarStore()
  state.syncing = true
  state.error = null
  try {
    const data = await store.exportData()
    const record = await cloud.uploadBackup(provider, data)
    state.lastSync[provider] = record
    if (showToast) useToast().show('Сохранено в облако')
  } catch (e) {
    state.error = e instanceof cloud.CloudAuthError ? authErrorMessage(provider) : 'Не удалось синхронизировать с облаком'
    if (showToast) useToast().show(state.error)
  } finally {
    state.syncing = false
  }
}

function scheduleAutoSync(): void {
  if (!state.activeProvider || !state.autoSync) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void syncNow(false), SYNC_DEBOUNCE_MS)
}

function ensureWatcher(): void {
  if (watcherStarted) return
  watcherStarted = true
  const store = useCarStore()
  watch([store.cars, store.items, store.fuelEntries, store.historyEntries], scheduleAutoSync, { deep: true })
}

async function connect(provider: CloudProvider): Promise<void> {
  haptic('tap')
  state.error = null
  try {
    const account = await cloud.connect(provider)
    refreshFromStorage()
    useToast().show(`Подключено: ${account.name}`)
    await syncNow(false)
  } catch {
    useToast().show('Не удалось подключиться')
  }
}

function disconnect(provider: CloudProvider): void {
  haptic('tap')
  cloud.disconnect(provider)
  refreshFromStorage()
  state.error = null
  useToast().show('Облако отключено')
}

function setAutoSync(enabled: boolean): void {
  state.autoSync = enabled
  cloud.setAutoSyncEnabled(enabled)
  if (enabled) scheduleAutoSync()
}

async function restoreFromCloud(provider: CloudProvider): Promise<{ ok: true } | { ok: false; error: string }> {
  const store = useCarStore()
  state.syncing = true
  state.error = null
  try {
    const result = await cloud.downloadBackup(provider)
    if (!result) return { ok: false, error: 'В облаке ещё нет резервной копии' }
    const imported = await store.importData(result.backup)
    if (!imported.ok) return imported
    state.lastSync[provider] = { savedAt: result.savedAt, appVersion: result.appVersion }
    haptic('success')
    return { ok: true }
  } catch (e) {
    const error = e instanceof cloud.CloudAuthError ? authErrorMessage(provider) : 'Не удалось получить данные из облака'
    state.error = error
    return { ok: false, error }
  } finally {
    state.syncing = false
  }
}

/** Call once on app boot: finishes a Yandex login that just redirected back, and starts the auto-sync watcher. */
function initCloudSync(): Promise<void> {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    ensureWatcher()
    const account = await cloud.finishPendingConnections()
    if (account) {
      refreshFromStorage()
      useToast().show(`Подключено: ${account.name}`)
      await syncNow(false)
    }
  })()
  return bootPromise
}

export function useCloudSync() {
  ensureWatcher()
  return {
    state,
    connect,
    disconnect,
    syncNow,
    restoreFromCloud,
    setAutoSync,
    initCloudSync,
    isProviderConfigured: cloud.isProviderConfigured,
  }
}
