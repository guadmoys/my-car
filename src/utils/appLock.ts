/**
 * A local device lock for the app: a PIN checked against a salted SHA-256
 * hash (via Web Crypto — nothing leaves the device, there's no server to
 * verify anything against), plus an optional WebAuthn platform-authenticator
 * step (Face ID / Touch ID / Android biometric or device PIN) as a faster
 * alternative to typing the PIN. This gates the UI, it does not encrypt the
 * IndexedDB data itself.
 */

const ENABLED_KEY = 'my-car-lock-enabled'
const SALT_KEY = 'my-car-lock-salt'
const HASH_KEY = 'my-car-lock-hash'
const WEBAUTHN_CREDENTIAL_KEY = 'my-car-lock-webauthn-credential'

export function isLockEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function setPin(pin: string): Promise<void> {
  const salt = randomHex(16)
  const hash = await hashPin(pin, salt)
  localStorage.setItem(SALT_KEY, salt)
  localStorage.setItem(HASH_KEY, hash)
  localStorage.setItem(ENABLED_KEY, 'true')
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = localStorage.getItem(SALT_KEY)
  const storedHash = localStorage.getItem(HASH_KEY)
  if (!salt || !storedHash) return false
  return (await hashPin(pin, salt)) === storedHash
}

/** Disables the lock entirely — passcode and any registered biometric. */
export function disableLock(): void {
  localStorage.removeItem(ENABLED_KEY)
  localStorage.removeItem(SALT_KEY)
  localStorage.removeItem(HASH_KEY)
  localStorage.removeItem(WEBAUTHN_CREDENTIAL_KEY)
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
