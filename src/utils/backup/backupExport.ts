import { openDB } from 'idb'

/**
 * Getting a backup file out of the app. A web app can't write to arbitrary
 * places on its own, so there are three ways, best first:
 *   1. a folder the user picked once (Chromium on desktop and some Android builds), written automatically;
 *   2. the system share sheet (iOS, Android), one tap to send it to Files, a messenger, mail, a drive;
 *   3. a plain download.
 */
export type SaveMethod = 'folder' | 'share' | 'download'

export type SaveResult = { ok: true; method: SaveMethod } | { ok: false; reason: 'cancelled' | 'failed' }

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `moya-mashina-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`
}

// ---------------------------------------------------------------------------
// Folder (File System Access API)
// ---------------------------------------------------------------------------

interface DirectoryHandle {
  name: string
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>
  getFileHandle(name: string, opts: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>
  removeEntry(name: string): Promise<void>
  entries(): AsyncIterableIterator<[string, { kind: 'file' | 'directory' }]>
}

const HANDLE_DB = 'my-car-prefs'
const HANDLE_KEY = 'backup-dir'
/** Old automatic copies beyond this many are deleted from the folder. */
export const KEEP_FILES = 10
const BACKUP_NAME = /^moya-mashina-backup-\d{4}-\d{2}-\d{2}\.json$/

const handleDb = () =>
  openDB(HANDLE_DB, 1, {
    upgrade(db) {
      db.createObjectStore('handles')
    },
  })

export function isFolderSaveSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function getBackupFolder(): Promise<DirectoryHandle | null> {
  try {
    return ((await (await handleDb()).get('handles', HANDLE_KEY)) as DirectoryHandle | undefined) ?? null
  } catch {
    return null
  }
}

export async function chooseBackupFolder(): Promise<DirectoryHandle | null> {
  if (!isFolderSaveSupported()) return null
  try {
    const picker = (window as unknown as { showDirectoryPicker(o: { mode: 'readwrite'; id: string }): Promise<DirectoryHandle> }).showDirectoryPicker
    const dir = await picker.call(window, { mode: 'readwrite', id: 'my-car-backups' })
    await (await handleDb()).put('handles', dir, HANDLE_KEY)
    return dir
  } catch {
    return null // cancelled
  }
}

export async function forgetBackupFolder(): Promise<void> {
  try {
    await (await handleDb()).delete('handles', HANDLE_KEY)
  } catch {
    /* nothing to forget */
  }
}

/** True when the saved folder can be written to without asking (the browser may ask again each session). */
export async function folderReady(dir: DirectoryHandle | null): Promise<boolean> {
  if (!dir) return false
  try {
    return (await dir.queryPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

/** Writes the file into the folder and trims old copies. `prompt` lets a tap re-grant a lapsed permission. */
export async function writeToFolder(dir: DirectoryHandle, name: string, text: string, prompt = false): Promise<boolean> {
  try {
    let state = await dir.queryPermission({ mode: 'readwrite' })
    if (state !== 'granted' && prompt) state = await dir.requestPermission({ mode: 'readwrite' })
    if (state !== 'granted') return false
    const file = await dir.getFileHandle(name, { create: true })
    const writable = await file.createWritable()
    await writable.write(text)
    await writable.close()
    await pruneFolder(dir)
    return true
  } catch {
    return false
  }
}

async function pruneFolder(dir: DirectoryHandle): Promise<void> {
  try {
    const names: string[] = []
    for await (const [name, entry] of dir.entries()) if (entry.kind === 'file' && BACKUP_NAME.test(name)) names.push(name)
    // The date is in the name, so sorting by name sorts by age.
    names.sort()
    for (const old of names.slice(0, Math.max(0, names.length - KEEP_FILES))) await dir.removeEntry(old)
  } catch {
    /* trimming is a courtesy, never a failure */
  }
}

// ---------------------------------------------------------------------------
// Share sheet and download
// ---------------------------------------------------------------------------

export function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
  return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
}

function downloadFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Saves a backup the best way available. Must be called from a tap when the
 * share sheet or a permission prompt may be needed.
 */
export async function saveBackup(name: string, text: string): Promise<SaveResult> {
  const folder = await getBackupFolder()
  if (folder && (await writeToFolder(folder, name, text, true))) return { ok: true, method: 'folder' }

  const file = new File([text], name, { type: 'application/json' })
  if (canShareFiles(file)) {
    try {
      await (navigator as Navigator & { share(d: { files: File[]; title: string }): Promise<void> }).share({ files: [file], title: 'Моя машина — резервная копия' })
      return { ok: true, method: 'share' }
    } catch (e) {
      // Closing the share sheet is a choice, not a failure.
      if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, reason: 'cancelled' }
      // Anything else (some browsers refuse files): fall through to a download.
    }
  }

  try {
    downloadFile(name, text)
    return { ok: true, method: 'download' }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
