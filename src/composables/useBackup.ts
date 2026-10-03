import { reactive } from 'vue'
import { useCarStore } from './useCarStore'
import { useToast } from './useToast'
import { getActiveProvider, getLastSync } from '../utils/backup/cloudSync'
import {
  backupState,
  getBackupIntervalDays,
  getLastBackupAt,
  markBackupDone,
  setBackupIntervalDays,
  snoozeBackup,
} from '../utils/backup/backupSchedule'
import {
  backupFileName,
  chooseBackupFolder,
  folderReady,
  forgetBackupFolder,
  getBackupFolder,
  isFolderSaveSupported,
  saveBackup,
  writeToFolder,
} from '../utils/backup/backupExport'
import { isVaultEnabled, isVaultUnlocked, serializeBackup } from '../utils/security/vault'

const state = reactive({
  due: false,
  daysSince: null as number | null,
  never: false,
  lastAt: null as number | null,
  intervalDays: getBackupIntervalDays(),
  folderSupported: isFolderSaveSupported(),
  folderName: null as string | null,
  saving: false,
})

/** Time of the newest copy made by cloud sync, which counts as a backup too. */
function cloudBackupAt(): number | null {
  const provider = getActiveProvider()
  return provider ? (getLastSync(provider)?.savedAt ?? null) : null
}

/** Re-reads everything the reminder depends on. Cheap; call it whenever the app wakes up or data changes. */
async function refresh(): Promise<void> {
  const store = useCarStore()
  const s = backupState({ hasData: store.cars.length > 0, externalAt: cloudBackupAt() })
  state.due = s.due
  state.daysSince = s.daysSince
  state.never = s.never
  state.lastAt = Math.max(getLastBackupAt() ?? 0, cloudBackupAt() ?? 0) || null
  state.intervalDays = getBackupIntervalDays()
  state.folderName = (await getBackupFolder())?.name ?? null
}

/** Builds the file (encrypted when encryption is on) and saves it the best way available. Call from a tap. */
async function saveNow(): Promise<boolean> {
  if (state.saving) return false
  if (isVaultEnabled() && !isVaultUnlocked()) return false
  const store = useCarStore()
  const toast = useToast()
  state.saving = true
  try {
    const text = await serializeBackup(await store.exportData())
    const result = await saveBackup(backupFileName(), text)
    if (!result.ok) {
      if (result.reason === 'failed') toast.show('Не удалось сохранить копию')
      return false
    }
    markBackupDone()
    toast.show(result.method === 'folder' ? `Копия сохранена в папку «${state.folderName ?? 'копий'}»` : 'Копия сохранена')
    return true
  } catch {
    toast.show('Не удалось сохранить копию')
    return false
  } finally {
    state.saving = false
    await refresh()
  }
}

/**
 * When a copy is due and a folder was chosen and is still writable, saves it
 * without any tap. Returns true if it did. Otherwise the reminder banner stays.
 */
async function autoSaveToFolder(): Promise<boolean> {
  if (!state.due || state.saving) return false
  if (isVaultEnabled() && !isVaultUnlocked()) return false
  const folder = await getBackupFolder()
  if (!folder || !(await folderReady(folder))) return false
  try {
    const text = await serializeBackup(await useCarStore().exportData())
    if (!(await writeToFolder(folder, backupFileName(), text))) return false
    markBackupDone()
    useToast().show(`Копия сохранена в папку «${folder.name}»`)
    return true
  } catch {
    return false
  } finally {
    await refresh()
  }
}

async function snooze(): Promise<void> {
  snoozeBackup()
  await refresh()
}

async function setInterval_(days: number): Promise<void> {
  setBackupIntervalDays(days)
  await refresh()
}

async function pickFolder(): Promise<boolean> {
  const dir = await chooseBackupFolder()
  await refresh()
  return dir !== null
}

async function clearFolder(): Promise<void> {
  await forgetBackupFolder()
  await refresh()
}

export function useBackup() {
  return { state, refresh, saveNow, autoSaveToFolder, snooze, setInterval: setInterval_, pickFolder, clearFolder }
}
