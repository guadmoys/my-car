import { describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})

import { isBiometricEnabled, isLockEnabled, lockoutRemainingMs } from '../security/appLock'
import { isVaultEnabled, isVaultUnlocked, vaultLockoutRemainingMs } from '../security/vault'

describe('fresh install', () => {
  it('has no PIN, no biometrics and no encryption, so nothing blocks the first launch', () => {
    expect(isLockEnabled()).toBe(false)
    expect(isBiometricEnabled()).toBe(false)
    expect(isVaultEnabled()).toBe(false)
    expect(isVaultUnlocked()).toBe(false)
    expect(lockoutRemainingMs()).toBe(0)
    expect(vaultLockoutRemainingMs()).toBe(0)
  })
})
