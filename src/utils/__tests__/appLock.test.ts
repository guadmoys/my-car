import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})

import { disableLock, isLockEnabled, lockoutRemainingMs, setPin, verifyPin } from '../security/appLock'

async function legacySha(pin: string, salt: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}

beforeEach(() => memory.clear())

describe('app lock', () => {
  it('stores a PBKDF2 hash and verifies only the right PIN', async () => {
    await setPin('1234')
    expect(isLockEnabled()).toBe(true)
    expect(memory.get('my-car-lock-iterations')).toBe('300000')
    expect(memory.get('my-car-lock-hash')).toHaveLength(64)
    expect(await verifyPin('1234')).toBe(true)
    expect(await verifyPin('1235')).toBe(false)
  })

  it('still accepts a PIN saved by the old SHA-256 scheme and upgrades it', async () => {
    memory.set('my-car-lock-enabled', 'true')
    memory.set('my-car-lock-salt', 'abcd')
    memory.set('my-car-lock-hash', await legacySha('4321', 'abcd'))
    expect(await verifyPin('0000')).toBe(false)
    expect(await verifyPin('4321')).toBe(true)
    expect(memory.get('my-car-lock-iterations')).toBe('300000')
    expect(memory.get('my-car-lock-salt')).not.toBe('abcd')
    expect(await verifyPin('4321')).toBe(true)
    expect(await verifyPin('0000')).toBe(false)
  })

  it('pauses after five wrong attempts, doubling, and resets on success', async () => {
    await setPin('1234')
    const t0 = 1_000_000
    for (let i = 0; i < 4; i++) expect(await verifyPin('0', t0)).toBe(false)
    expect(lockoutRemainingMs(t0)).toBe(0)
    expect(await verifyPin('0', t0)).toBe(false) // fifth miss
    expect(lockoutRemainingMs(t0)).toBe(30_000)
    // During the pause even the right PIN is refused.
    expect(await verifyPin('1234', t0 + 1000)).toBe(false)
    expect(lockoutRemainingMs(t0 + 29_000)).toBe(1000)
    // After it, one more miss doubles the pause.
    expect(await verifyPin('0', t0 + 31_000)).toBe(false)
    expect(lockoutRemainingMs(t0 + 31_000)).toBe(60_000)
    expect(await verifyPin('1234', t0 + 100_000)).toBe(true)
    expect(lockoutRemainingMs(t0 + 100_000)).toBe(0)
  })

  it('caps the pause at 15 minutes and clears everything when disabled', async () => {
    await setPin('1234')
    let t = 0
    for (let i = 0; i < 20; i++) {
      t += 2_000_000
      await verifyPin('0', t)
    }
    expect(lockoutRemainingMs(t)).toBeLessThanOrEqual(15 * 60 * 1000)
    disableLock()
    expect(isLockEnabled()).toBe(false)
    expect(memory.get('my-car-lock-fails')).toBeUndefined()
    expect(await verifyPin('1234')).toBe(false)
  })
})
