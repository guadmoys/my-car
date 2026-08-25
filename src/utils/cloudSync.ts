import type { BackupData } from '../types'

export type CloudProvider = 'google' | 'yandex'

export interface CloudAccount {
  id: string
  name: string
  email?: string
}

export interface CloudSyncRecord {
  savedAt: number
  appVersion: string
}

/** Thrown when a provider call fails because the stored session is gone — the UI should prompt to reconnect. */
export class CloudAuthError extends Error {
  provider: CloudProvider
  constructor(provider: CloudProvider) {
    super(`Требуется повторный вход в ${provider === 'google' ? 'Google Диск' : 'Яндекс.Диск'}`)
    this.provider = provider
  }
}

interface CloudEnvelope {
  kind: 'moya-mashina-cloud-backup'
  cloudFormatVersion: 1
  appVersion: string
  savedAt: number
  backup: BackupData
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const YANDEX_CLIENT_ID = import.meta.env.VITE_YANDEX_CLIENT_ID ?? ''

const GOOGLE_SCOPES =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email'
const GOOGLE_BACKUP_FILE_NAME = 'moya-mashina-backup.json'
const YANDEX_BACKUP_PATH = 'app:/moya-mashina-backup.json'

const ACCOUNT_KEY = (p: CloudProvider) => `my-car-cloud-account-${p}`
const LAST_SYNC_KEY = (p: CloudProvider) => `my-car-cloud-last-sync-${p}`
const ACTIVE_PROVIDER_KEY = 'my-car-cloud-active-provider'
const AUTO_SYNC_KEY = 'my-car-cloud-auto-sync'
const YANDEX_TOKEN_KEY = 'my-car-cloud-yandex-token'

export function isProviderConfigured(provider: CloudProvider): boolean {
  return provider === 'google' ? GOOGLE_CLIENT_ID.length > 0 : YANDEX_CLIENT_ID.length > 0
}

export function getConnectedAccount(provider: CloudProvider): CloudAccount | null {
  const raw = localStorage.getItem(ACCOUNT_KEY(provider))
  if (!raw) return null
  try {
    return JSON.parse(raw) as CloudAccount
  } catch {
    return null
  }
}

function setAccount(provider: CloudProvider, account: CloudAccount): void {
  localStorage.setItem(ACCOUNT_KEY(provider), JSON.stringify(account))
}

export function getLastSync(provider: CloudProvider): CloudSyncRecord | null {
  const raw = localStorage.getItem(LAST_SYNC_KEY(provider))
  if (!raw) return null
  try {
    return JSON.parse(raw) as CloudSyncRecord
  } catch {
    return null
  }
}

function setLastSync(provider: CloudProvider, record: CloudSyncRecord): void {
  localStorage.setItem(LAST_SYNC_KEY(provider), JSON.stringify(record))
}

export function getActiveProvider(): CloudProvider | null {
  const v = localStorage.getItem(ACTIVE_PROVIDER_KEY)
  return v === 'google' || v === 'yandex' ? v : null
}

export function setActiveProvider(provider: CloudProvider | null): void {
  if (provider) localStorage.setItem(ACTIVE_PROVIDER_KEY, provider)
  else localStorage.removeItem(ACTIVE_PROVIDER_KEY)
}

export function isAutoSyncEnabled(): boolean {
  return localStorage.getItem(AUTO_SYNC_KEY) !== '0'
}

export function setAutoSyncEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_SYNC_KEY, enabled ? '1' : '0')
}

// ---------------------------------------------------------------------------
// Google Drive (appDataFolder) — client-side OAuth via Google Identity Services
// ---------------------------------------------------------------------------

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (resp: GoogleTokenResponse) => void
            error_callback?: (err: { type: string }) => void
          }): { requestAccessToken(opts: { prompt: string }): void }
          revoke?: (token: string, done: () => void) => void
        }
      }
    }
  }
}

let gisLoadPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Не удалось загрузить Google Identity Services'))
    document.head.appendChild(script)
  })
  return gisLoadPromise
}

let googleAccessToken: string | null = null
let googleTokenExpiresAt = 0

async function requestGoogleToken(interactive: boolean): Promise<string> {
  await loadGis()
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Identity Services недоступен'))
      return
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'auth_error'))
          return
        }
        googleAccessToken = resp.access_token
        googleTokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000
        resolve(resp.access_token)
      },
      error_callback: (err) => reject(new Error(err?.type ?? 'auth_error')),
    })
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

async function getGoogleAccessToken(interactive: boolean): Promise<string | null> {
  if (googleAccessToken && Date.now() < googleTokenExpiresAt - 30_000) return googleAccessToken
  try {
    return await requestGoogleToken(interactive)
  } catch {
    return null
  }
}

async function googleFetchAccount(token: string): Promise<CloudAccount> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) throw new Error(`Google: ${resp.status}`)
  const body = await resp.json()
  return { id: String(body.id ?? body.email), name: body.name ?? body.email ?? 'Google', email: body.email }
}

async function findGoogleFileId(token: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', `name='${GOOGLE_BACKUP_FILE_NAME}'`)
  url.searchParams.set('fields', 'files(id)')
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (resp.status === 401) throw new CloudAuthError('google')
  if (!resp.ok) throw new Error(`Google Drive: ${resp.status}`)
  const body = await resp.json()
  return body.files?.[0]?.id ?? null
}

async function googleUpload(token: string, json: string): Promise<void> {
  const existingId = await findGoogleFileId(token)
  const metadata = existingId ? {} : { name: GOOGLE_BACKUP_FILE_NAME, parents: ['appDataFolder'] }
  const boundary = 'moya-mashina-boundary'
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  const resp = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (resp.status === 401) throw new CloudAuthError('google')
  if (!resp.ok) throw new Error(`Google Drive: ${resp.status}`)
}

async function googleDownload(token: string): Promise<string | null> {
  const id = await findGoogleFileId(token)
  if (!id) return null
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (resp.status === 401) throw new CloudAuthError('google')
  if (!resp.ok) throw new Error(`Google Drive: ${resp.status}`)
  return resp.text()
}

// ---------------------------------------------------------------------------
// Yandex Disk (app folder) — client-side OAuth via the "token" redirect flow
// ---------------------------------------------------------------------------

function yandexRedirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

function startYandexAuth(): void {
  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('response_type', 'token')
  url.searchParams.set('client_id', YANDEX_CLIENT_ID)
  url.searchParams.set('redirect_uri', yandexRedirectUri())
  url.searchParams.set('force_confirm', 'yes')
  window.location.assign(url.toString())
}

function consumeYandexRedirectTokenFromHash(): string | null {
  if (!window.location.hash) return null
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (!params.has('access_token') && !params.has('error')) return null
  const token = params.get('access_token')
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

async function yandexFetchAccount(token: string): Promise<CloudAccount> {
  const resp = await fetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${token}` },
  })
  if (!resp.ok) throw new Error(`Яндекс: ${resp.status}`)
  const body = await resp.json()
  return {
    id: String(body.id ?? body.login),
    name: body.real_name || body.display_name || body.login,
    email: body.default_email,
  }
}

async function yandexUpload(token: string, json: string): Promise<void> {
  const uploadUrl = new URL('https://cloud-api.yandex.net/v1/disk/resources/upload')
  uploadUrl.searchParams.set('path', YANDEX_BACKUP_PATH)
  uploadUrl.searchParams.set('overwrite', 'true')
  const metaResp = await fetch(uploadUrl, { headers: { Authorization: `OAuth ${token}` } })
  if (metaResp.status === 401) throw new CloudAuthError('yandex')
  if (!metaResp.ok) throw new Error(`Яндекс.Диск: ${metaResp.status}`)
  const { href } = await metaResp.json()
  const putResp = await fetch(href, { method: 'PUT', body: json })
  if (!putResp.ok) throw new Error(`Яндекс.Диск: ${putResp.status}`)
}

async function yandexDownload(token: string): Promise<string | null> {
  const metaUrl = new URL('https://cloud-api.yandex.net/v1/disk/resources/download')
  metaUrl.searchParams.set('path', YANDEX_BACKUP_PATH)
  const metaResp = await fetch(metaUrl, { headers: { Authorization: `OAuth ${token}` } })
  if (metaResp.status === 401) throw new CloudAuthError('yandex')
  if (metaResp.status === 404) return null
  if (!metaResp.ok) throw new Error(`Яндекс.Диск: ${metaResp.status}`)
  const { href } = await metaResp.json()
  const fileResp = await fetch(href)
  if (!fileResp.ok) throw new Error(`Яндекс.Диск: ${fileResp.status}`)
  return fileResp.text()
}

// ---------------------------------------------------------------------------
// Public, provider-agnostic API
// ---------------------------------------------------------------------------

async function getAccessToken(provider: CloudProvider, interactive: boolean): Promise<string | null> {
  if (provider === 'google') return getGoogleAccessToken(interactive)
  const stored = localStorage.getItem(YANDEX_TOKEN_KEY)
  if (stored) return stored
  if (interactive) startYandexAuth()
  return null
}

/** Logs in interactively. Google resolves with the account; Yandex navigates away and never resolves. */
export function connect(provider: CloudProvider): Promise<CloudAccount> {
  const previous = getActiveProvider()
  if (previous && previous !== provider) disconnect(previous)

  if (provider === 'yandex') {
    startYandexAuth()
    return new Promise(() => {})
  }

  return requestGoogleToken(true).then(async (token) => {
    const account = await googleFetchAccount(token)
    setActiveProvider('google')
    setAccount('google', account)
    return account
  })
}

/** Call once on app boot to finish a Yandex login that just redirected back. */
export async function finishPendingConnections(): Promise<CloudAccount | null> {
  const token = consumeYandexRedirectTokenFromHash()
  if (!token) return null
  try {
    const account = await yandexFetchAccount(token)
    localStorage.setItem(YANDEX_TOKEN_KEY, token)
    setActiveProvider('yandex')
    setAccount('yandex', account)
    return account
  } catch {
    return null
  }
}

export function disconnect(provider: CloudProvider): void {
  if (provider === 'google') {
    if (googleAccessToken && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(googleAccessToken, () => {})
    }
    googleAccessToken = null
    googleTokenExpiresAt = 0
  } else {
    localStorage.removeItem(YANDEX_TOKEN_KEY)
  }
  localStorage.removeItem(ACCOUNT_KEY(provider))
  localStorage.removeItem(LAST_SYNC_KEY(provider))
  if (getActiveProvider() === provider) setActiveProvider(null)
}

export async function uploadBackup(provider: CloudProvider, data: BackupData): Promise<CloudSyncRecord> {
  const token = await getAccessToken(provider, false)
  if (!token) throw new CloudAuthError(provider)

  const envelope: CloudEnvelope = {
    kind: 'moya-mashina-cloud-backup',
    cloudFormatVersion: 1,
    appVersion: __APP_VERSION__,
    savedAt: Date.now(),
    backup: data,
  }
  const json = JSON.stringify(envelope)

  if (provider === 'google') await googleUpload(token, json)
  else await yandexUpload(token, json)

  const record: CloudSyncRecord = { savedAt: envelope.savedAt, appVersion: envelope.appVersion }
  setLastSync(provider, record)
  return record
}

export async function downloadBackup(
  provider: CloudProvider,
): Promise<{ backup: BackupData; appVersion: string; savedAt: number } | null> {
  const token = await getAccessToken(provider, false)
  if (!token) throw new CloudAuthError(provider)

  const json = provider === 'google' ? await googleDownload(token) : await yandexDownload(token)
  if (!json) return null

  let envelope: Partial<CloudEnvelope>
  try {
    envelope = JSON.parse(json) as Partial<CloudEnvelope>
  } catch {
    throw new Error('Файл в облаке повреждён')
  }
  if (envelope.kind !== 'moya-mashina-cloud-backup' || !envelope.backup) {
    throw new Error('Файл в облаке имеет неизвестный формат')
  }

  const record: CloudSyncRecord = { savedAt: envelope.savedAt ?? 0, appVersion: envelope.appVersion ?? '?' }
  setLastSync(provider, record)
  return { backup: envelope.backup, appVersion: record.appVersion, savedAt: record.savedAt }
}
