/**
 * Encryption at rest for the whole app (opt-in, Settings → «Шифрование данных»).
 *
 * One random 256-bit data key (DEK) encrypts every stored record with
 * AES-256-GCM. The DEK itself never touches storage in the clear; it is kept
 * in two wrapped copies:
 *   - under a key derived from the user's passphrase with Argon2id
 *     (memory-hard, so guessing offline is expensive), and
 *   - under a key derived from a random recovery code (160 bits of entropy,
 *     shown once), which is the only way back in if the passphrase is lost.
 * While the app is unlocked the DEK lives in memory as a non-extractable
 * CryptoKey; locking drops it. There is deliberately no server and no backdoor:
 * lose both the passphrase and the recovery code and the data is gone.
 */

const META_KEY = 'my-car-vault-v1'
const FAILS_KEY = 'my-car-vault-fails'
const LOCKED_UNTIL_KEY = 'my-car-vault-until'
const AUTOLOCK_KEY = 'my-car-vault-autolock-min'

export interface KdfParams {
  name: 'argon2id'
  /** Memory in KiB. */
  m: number
  /** Passes. */
  t: number
  /** Lanes. */
  p: number
}

/** 64 MiB, 3 passes: roughly half a second on a phone, and costly to parallelise on a GPU. */
export const DEFAULT_KDF: KdfParams = { name: 'argon2id', m: 65536, t: 3, p: 1 }

export interface Blob64 {
  /** Base64 initialisation vector. */
  iv: string
  /** Base64 ciphertext (with the GCM tag). */
  ct: string
}

export interface WrappedKey extends Blob64 {
  /** Base64 salt for the passphrase KDF; absent for the recovery wrap (the code is already high-entropy). */
  salt?: string
}

export interface VaultMeta {
  v: 1
  kdf: KdfParams
  pass: WrappedKey
  recovery: WrappedKey
  createdAt: number
}

export class VaultLockedError extends Error {
  constructor() {
    super('Данные зашифрованы — введите пароль')
    this.name = 'VaultLockedError'
  }
}

export class VaultAuthError extends Error {
  constructor(message = 'Неверный пароль') {
    super(message)
    this.name = 'VaultAuthError'
  }
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const enc = new TextEncoder()
const dec = new TextDecoder()

// Crockford base32 (no I, L, O, U) keeps the recovery code readable and typo-tolerant.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

/** A fresh 160-bit recovery code, formatted as 8 groups of 4 characters. */
export function generateRecoveryCode(): string {
  const raw = bytesToBase32(crypto.getRandomValues(new Uint8Array(20)))
  return raw.match(/.{1,4}/g)!.join('-')
}

/** Normalises what the user typed: case, separators, and the look-alike letters Crockford treats as digits. */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

// ---------------------------------------------------------------------------
// Key derivation and wrapping
// ---------------------------------------------------------------------------

async function deriveFromPassphrase(passphrase: string, salt: Uint8Array<ArrayBuffer>, kdf: KdfParams): Promise<CryptoKey> {
  // Lazy: the wasm is only fetched when someone actually unlocks or sets a passphrase.
  const { argon2id } = await import('hash-wasm')
  const bits = await argon2id({
    password: passphrase.normalize('NFKC'),
    salt,
    parallelism: kdf.p,
    iterations: kdf.t,
    memorySize: kdf.m,
    hashLength: 32,
    outputType: 'binary',
  })
  return crypto.subtle.importKey('raw', bits as Uint8Array<ArrayBuffer>, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function deriveFromRecoveryCode(code: string): Promise<CryptoKey> {
  const normalized = normalizeRecoveryCode(code)
  const ikm = await crypto.subtle.importKey('raw', enc.encode(normalized), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('moya-mashina-recovery-v1'), info: enc.encode('wrap') },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function aesEncrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>, aad?: string): Promise<Blob64> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad ? enc.encode(aad) : undefined },
    key,
    data,
  )
  return { iv: toB64(iv), ct: toB64(ct) }
}

async function aesDecrypt(key: CryptoKey, blob: Blob64, aad?: string): Promise<Uint8Array<ArrayBuffer>> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(blob.iv), additionalData: aad ? enc.encode(aad) : undefined },
    key,
    fromB64(blob.ct),
  )
  return new Uint8Array(pt)
}

async function wrapWithPassphrase(raw: Uint8Array<ArrayBuffer>, passphrase: string, kdf: KdfParams): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const kek = await deriveFromPassphrase(passphrase, salt, kdf)
  return { salt: toB64(salt), ...(await aesEncrypt(kek, raw, 'dek')) }
}

async function wrapWithRecovery(raw: Uint8Array<ArrayBuffer>, code: string): Promise<WrappedKey> {
  return aesEncrypt(await deriveFromRecoveryCode(code), raw, 'dek')
}

async function unwrapRaw(meta: Pick<VaultMeta, 'kdf' | 'pass' | 'recovery'>, secret: Secret): Promise<Uint8Array<ArrayBuffer>> {
  try {
    if ('passphrase' in secret) {
      const w = meta.pass
      const kek = await deriveFromPassphrase(secret.passphrase, fromB64(w.salt!), meta.kdf)
      return await aesDecrypt(kek, w, 'dek')
    }
    return await aesDecrypt(await deriveFromRecoveryCode(secret.recoveryCode), meta.recovery, 'dek')
  } catch {
    // AES-GCM authentication failure is the only way a wrong secret shows up.
    throw new VaultAuthError('passphrase' in secret ? 'Неверный пароль' : 'Неверный ключ восстановления')
  }
}

async function importDek(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export type Secret = { passphrase: string } | { recoveryCode: string }

// ---------------------------------------------------------------------------
// Passphrase policy
// ---------------------------------------------------------------------------

const COMMON = ['password', 'qwerty', '123456', 'йцукен', 'пароль', 'letmein', 'iloveyou', 'admin']

/** A rough strength estimate, in bits, from length and character classes (not a substitute for a long random passphrase). */
export function passphraseBits(p: string): number {
  let pool = 0
  if (/[a-zа-яё]/.test(p)) pool += 30
  if (/[A-ZА-ЯЁ]/.test(p)) pool += 30
  if (/\d/.test(p)) pool += 10
  if (/[^\p{L}\d]/u.test(p)) pool += 20
  const unique = new Set(p).size
  // Repeated characters carry little entropy; count only a share of them.
  const effectiveLength = Math.min(p.length, unique * 2)
  return pool === 0 ? 0 : Math.round(effectiveLength * Math.log2(pool))
}

/** Why a passphrase is rejected, or null when it is acceptable. */
export function passphraseProblem(p: string): string | null {
  if (p.length < 10) return 'Минимум 10 символов'
  const lower = p.toLowerCase()
  if (COMMON.some((c) => lower.includes(c)) && p.length < 16) return 'Слишком простой пароль'
  if (new Set(p).size < 5) return 'Слишком много повторяющихся символов'
  if (passphraseBits(p) < 45) return 'Добавьте длины или разных символов — лучше фраза из нескольких слов'
  return null
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let dek: CryptoKey | null = null
// Bumped on every lock/unlock so UI can react without polling.
const listeners = new Set<() => void>()

function notify(): void {
  for (const l of listeners) l()
}

export function onVaultStateChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getVaultMeta(): VaultMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as VaultMeta
    return meta && meta.v === 1 && meta.pass && meta.recovery && meta.kdf ? meta : null
  } catch {
    return null
  }
}

export function isVaultEnabled(): boolean {
  return getVaultMeta() !== null
}

export function isVaultUnlocked(): boolean {
  return dek !== null
}

/** Throws VaultLockedError unless the vault is open; callers that must not run while locked use this. */
export function requireDek(): CryptoKey {
  if (!dek) throw new VaultLockedError()
  return dek
}

export function lockVault(): void {
  if (dek !== null) {
    dek = null
    notify()
  }
}

// ---------------------------------------------------------------------------
// Attempt throttling (client-side speed bump; the Argon2 cost is the real defence)
// ---------------------------------------------------------------------------

const FREE_ATTEMPTS = 5
const MAX_PAUSE_MS = 15 * 60 * 1000

export function vaultLockoutRemainingMs(now = Date.now()): number {
  const until = Number(localStorage.getItem(LOCKED_UNTIL_KEY))
  return Number.isFinite(until) && until > now ? until - now : 0
}

function recordFailure(now: number): void {
  const fails = (Number(localStorage.getItem(FAILS_KEY)) || 0) + 1
  localStorage.setItem(FAILS_KEY, String(fails))
  if (fails >= FREE_ATTEMPTS) {
    const pause = Math.min(MAX_PAUSE_MS, 30_000 * 2 ** (fails - FREE_ATTEMPTS))
    localStorage.setItem(LOCKED_UNTIL_KEY, String(now + pause))
  }
}

function resetFailures(): void {
  localStorage.removeItem(FAILS_KEY)
  localStorage.removeItem(LOCKED_UNTIL_KEY)
}

// ---------------------------------------------------------------------------
// Public lifecycle
// ---------------------------------------------------------------------------

export interface CreatedVault {
  meta: VaultMeta
  /** Shown to the user exactly once. */
  recoveryCode: string
}

/**
 * Creates the keys and keeps the vault unlocked in memory. Does not persist
 * anything: the caller saves `meta` with saveVaultMeta() once the data has
 * been (or is about to be) encrypted.
 */
export async function createVault(passphrase: string, kdf: KdfParams = DEFAULT_KDF): Promise<CreatedVault> {
  const problem = passphraseProblem(passphrase)
  if (problem) throw new Error(problem)
  const raw = crypto.getRandomValues(new Uint8Array(32))
  const recoveryCode = generateRecoveryCode()
  const meta: VaultMeta = {
    v: 1,
    kdf,
    pass: await wrapWithPassphrase(raw, passphrase, kdf),
    recovery: await wrapWithRecovery(raw, recoveryCode),
    createdAt: Date.now(),
  }
  dek = await importDek(raw)
  raw.fill(0)
  notify()
  return { meta, recoveryCode }
}

export function saveVaultMeta(meta: VaultMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function clearVaultMeta(): void {
  localStorage.removeItem(META_KEY)
  resetFailures()
}

/** Unlocks with the passphrase (counts failures and pauses) or the recovery code. */
export async function unlockVault(secret: Secret, now = Date.now()): Promise<void> {
  const meta = getVaultMeta()
  if (!meta) throw new Error('Шифрование не включено')
  if (vaultLockoutRemainingMs(now) > 0) throw new VaultAuthError('Слишком много попыток — подождите')
  let raw: Uint8Array<ArrayBuffer>
  try {
    raw = await unwrapRaw(meta, secret)
  } catch (e) {
    recordFailure(now)
    throw e
  }
  resetFailures()
  dek = await importDek(raw)
  raw.fill(0)
  notify()
}

/** Verifies a secret without changing lock state (used to confirm sensitive actions). */
export async function verifyVaultSecret(secret: Secret): Promise<boolean> {
  const meta = getVaultMeta()
  if (!meta) return false
  try {
    const raw = await unwrapRaw(meta, secret)
    raw.fill(0)
    return true
  } catch {
    return false
  }
}

/**
 * Re-wraps the data key under a new passphrase. The old secret (passphrase or
 * recovery code) is checked first, which is also how a forgotten passphrase is
 * replaced after unlocking with the recovery code. The recovery code stays valid.
 */
export async function changePassphrase(current: Secret, next: string, kdf?: KdfParams): Promise<void> {
  const meta = getVaultMeta()
  if (!meta) throw new Error('Шифрование не включено')
  const problem = passphraseProblem(next)
  if (problem) throw new Error(problem)
  const raw = await unwrapRaw(meta, current)
  const params = kdf ?? meta.kdf
  const pass = await wrapWithPassphrase(raw, next, params)
  raw.fill(0)
  saveVaultMeta({ ...meta, kdf: params, pass })
}

/** Issues a new recovery code (the old one stops working). Needs the passphrase. */
export async function rotateRecoveryCode(passphrase: string): Promise<string> {
  const meta = getVaultMeta()
  if (!meta) throw new Error('Шифрование не включено')
  const raw = await unwrapRaw(meta, { passphrase })
  const recoveryCode = generateRecoveryCode()
  const recovery = await wrapWithRecovery(raw, recoveryCode)
  raw.fill(0)
  saveVaultMeta({ ...meta, recovery })
  return recoveryCode
}

// ---------------------------------------------------------------------------
// Data encryption
// ---------------------------------------------------------------------------

export interface Sealed {
  /** Format version. */
  e: 1
  iv: string
  ct: string
}

export function isSealed(value: unknown): value is Sealed {
  return typeof value === 'object' && value !== null && (value as Sealed).e === 1 && typeof (value as Sealed).ct === 'string'
}

/** Encrypts any JSON value with the open vault key. `aad` binds the ciphertext to where it lives. */
export async function sealJson(value: unknown, aad: string, key: CryptoKey = requireDek()): Promise<Sealed> {
  const blob = await aesEncrypt(key, enc.encode(JSON.stringify(value)), aad)
  return { e: 1, ...blob }
}

export async function openJson<T>(sealed: Sealed, aad: string, key: CryptoKey = requireDek()): Promise<T> {
  try {
    return JSON.parse(dec.decode(await aesDecrypt(key, sealed, aad))) as T
  } catch {
    throw new Error('Не удалось расшифровать запись — данные повреждены или относятся к другому ключу')
  }
}

export async function sealString(value: string, aad: string): Promise<string> {
  const s = await sealJson(value, aad)
  return `enc1:${s.iv}:${s.ct}`
}

export async function openString(value: string, aad: string): Promise<string> {
  if (!value.startsWith('enc1:')) return value
  const [, iv, ct] = value.split(':')
  return openJson<string>({ e: 1, iv, ct }, aad)
}

// ---------------------------------------------------------------------------
// Portable encrypted backups (files and cloud)
// ---------------------------------------------------------------------------

export interface EncryptedBackup {
  kind: 'moya-mashina-encrypted-backup'
  v: 1
  kdf: KdfParams
  /** The same wrapped data key the device holds, so the file opens with the passphrase or recovery code anywhere. */
  pass: WrappedKey
  recovery: WrappedKey
  payload: Sealed
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  return typeof value === 'object' && value !== null && (value as EncryptedBackup).kind === 'moya-mashina-encrypted-backup'
}

/** Encrypts a backup with the open vault key; throws VaultLockedError when locked. */
export async function encryptBackup(data: unknown): Promise<EncryptedBackup> {
  const meta = getVaultMeta()
  if (!meta) throw new Error('Шифрование не включено')
  return {
    kind: 'moya-mashina-encrypted-backup',
    v: 1,
    kdf: meta.kdf,
    pass: meta.pass,
    recovery: meta.recovery,
    payload: await sealJson(data, 'backup'),
  }
}

/**
 * Opens an encrypted backup. When the file was made by this very device's vault
 * and it is unlocked, no secret is needed; otherwise pass the passphrase or the
 * recovery code the file was created with.
 */
export async function decryptBackup<T>(file: EncryptedBackup, secret?: Secret): Promise<T> {
  const meta = getVaultMeta()
  if (dek && meta && meta.pass.ct === file.pass.ct && meta.pass.iv === file.pass.iv) {
    return openJson<T>(file.payload, 'backup', dek)
  }
  if (!secret) throw new VaultAuthError('Нужен пароль или ключ восстановления')
  const raw = await unwrapRaw(file, secret)
  const key = await importDek(raw)
  raw.fill(0)
  return openJson<T>(file.payload, 'backup', key)
}

/** Turns backup data into the text to save: encrypted when the vault is on, readable JSON otherwise. */
export async function serializeBackup(data: unknown): Promise<string> {
  return isVaultEnabled() ? JSON.stringify(await encryptBackup(data)) : JSON.stringify(data, null, 2)
}

// ---------------------------------------------------------------------------
// Auto-lock preference
// ---------------------------------------------------------------------------

/** Minutes the app may stay in the background before it locks again; 0 means lock immediately. */
export function getAutoLockMinutes(): number {
  const n = Number(localStorage.getItem(AUTOLOCK_KEY))
  return Number.isFinite(n) && n >= 0 && localStorage.getItem(AUTOLOCK_KEY) !== null ? n : 5
}

export function setAutoLockMinutes(minutes: number): void {
  localStorage.setItem(AUTOLOCK_KEY, String(Math.max(0, Math.round(minutes))))
}
