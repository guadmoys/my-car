/**
 * A local device lock for the app: a PIN checked against a salted PBKDF2-SHA-256
 * hash (via Web Crypto — nothing leaves the device, there's no server to
 * verify anything against), plus an optional WebAuthn platform-authenticator
 * step (Face ID / Touch ID / Android biometric or device PIN) as a faster
 * alternative to typing the PIN. This gates the UI, it does not encrypt the
 * IndexedDB data itself.
 */

const ENABLED_KEY = 'my-car-lock-enabled'
const SALT_KEY = 'my-car-lock-salt'
const HASH_KEY = 'my-car-lock-hash'
/** Present only for PBKDF2 hashes; a PIN saved by an older version has no iteration count and is a plain salted SHA-256. */
const ITERATIONS_KEY = 'my-car-lock-iterations'
const FAILS_KEY = 'my-car-lock-fails'
const LOCKED_UNTIL_KEY = 'my-car-lock-until'
const WEBAUTHN_CREDENTIAL_KEY = 'my-car-lock-webauthn-credential'

const PBKDF2_ITERATIONS = 300_000
/** Wrong attempts allowed before a pause starts. */
const FREE_ATTEMPTS = 5
const MAX_PAUSE_MS = 15 * 60 * 1000

export function isLockEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The pre-PBKDF2 scheme, kept only so existing PINs keep working until their next successful unlock. */
async function legacyHashPin(pin: string, salt: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)))
}

async function pbkdf2HashPin(pin: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations },
    key,
    256,
  )
  return toHex(bits)
}

/** Length-independent comparison, so timing doesn't reveal how many leading characters matched. */
function equalStrings(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

async function storeHash(pin: string): Promise<void> {
  const salt = randomHex(16)
  const hash = await pbkdf2HashPin(pin, salt, PBKDF2_ITERATIONS)
  localStorage.setItem(SALT_KEY, salt)
  localStorage.setItem(HASH_KEY, hash)
  localStorage.setItem(ITERATIONS_KEY, String(PBKDF2_ITERATIONS))
}

export async function setPin(pin: string): Promise<void> {
  await storeHash(pin)
  localStorage.setItem(ENABLED_KEY, 'true')
  resetFailures()
}

function resetFailures(): void {
  localStorage.removeItem(FAILS_KEY)
  localStorage.removeItem(LOCKED_UNTIL_KEY)
}

/** Milliseconds left of the pause after too many wrong attempts; 0 when entering a PIN is allowed. */
export function lockoutRemainingMs(now = Date.now()): number {
  const until = Number(localStorage.getItem(LOCKED_UNTIL_KEY))
  return Number.isFinite(until) && until > now ? until - now : 0
}

function recordFailure(now: number): void {
  const fails = (Number(localStorage.getItem(FAILS_KEY)) || 0) + 1
  localStorage.setItem(FAILS_KEY, String(fails))
  if (fails >= FREE_ATTEMPTS) {
    // 30 s after the fifth miss, doubling each time, capped at 15 min.
    const pause = Math.min(MAX_PAUSE_MS, 30_000 * 2 ** (fails - FREE_ATTEMPTS))
    localStorage.setItem(LOCKED_UNTIL_KEY, String(now + pause))
  }
}

export async function verifyPin(pin: string, now = Date.now()): Promise<boolean> {
  if (lockoutRemainingMs(now) > 0) return false
  const salt = localStorage.getItem(SALT_KEY)
  const storedHash = localStorage.getItem(HASH_KEY)
  if (!salt || !storedHash) return false

  const iterations = Number(localStorage.getItem(ITERATIONS_KEY))
  const isLegacy = !Number.isFinite(iterations) || iterations <= 0
  const candidate = isLegacy ? await legacyHashPin(pin, salt) : await pbkdf2HashPin(pin, salt, iterations)
  if (!equalStrings(candidate, storedHash)) {
    recordFailure(now)
    return false
  }

  resetFailures()
  // Upgrade an old SHA-256 PIN to PBKDF2 now that we hold the plaintext.
  if (isLegacy) await storeHash(pin).catch(() => {})
  return true
}

/** Disables the lock entirely — passcode and any registered biometric. */
export function disableLock(): void {
  localStorage.removeItem(ENABLED_KEY)
  localStorage.removeItem(SALT_KEY)
  localStorage.removeItem(HASH_KEY)
  localStorage.removeItem(ITERATIONS_KEY)
  localStorage.removeItem(WEBAUTHN_CREDENTIAL_KEY)
  resetFailures()
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buf)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(WEBAUTHN_CREDENTIAL_KEY) !== null
}

/** Registers a platform-authenticator credential (Face ID / Touch ID / Android biometric or device PIN). */
export async function registerBiometric(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Моя машина' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'owner',
          displayName: 'Владелец',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null
    if (!credential) return false
    localStorage.setItem(WEBAUTHN_CREDENTIAL_KEY, bufferToBase64Url(credential.rawId))
    return true
  } catch {
    return false
  }
}

export function disableBiometric(): void {
  localStorage.removeItem(WEBAUTHN_CREDENTIAL_KEY)
}

/**
 * Asks the OS to verify the user against the registered platform
 * authenticator. There's no server to check the returned assertion's
 * signature against, so success is simply the browser resolving the
 * promise — which it only does after a real Face ID/Touch ID/biometric/
 * device-PIN check by the OS.
 */
export async function verifyBiometric(): Promise<boolean> {
  const credentialId = localStorage.getItem(WEBAUTHN_CREDENTIAL_KEY)
  if (!credentialId || !isWebAuthnSupported()) return false
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: base64UrlToBuffer(credentialId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return assertion !== null
  } catch {
    return false
  }
}
