import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
})

import {
  VaultAuthError,
  VaultLockedError,
  changePassphrase,
  clearVaultMeta,
  createVault,
  decryptBackup,
  encryptBackup,
  generateRecoveryCode,
  getVaultMeta,
  isEncryptedBackup,
  isVaultEnabled,
  isVaultUnlocked,
  lockVault,
  normalizeRecoveryCode,
  openJson,
  openString,
  passphraseBits,
  passphraseProblem,
  rotateRecoveryCode,
  saveVaultMeta,
  sealJson,
  sealString,
  unlockVault,
  vaultLockoutRemainingMs,
  verifyVaultSecret,
  type KdfParams,
} from '../security/vault'

// Same algorithm, tiny cost, so the suite stays fast.
const FAST: KdfParams = { name: 'argon2id', m: 64, t: 1, p: 1 }
const PASS = 'correct horse battery staple'

async function setup() {
  const { meta, recoveryCode } = await createVault(PASS, FAST)
  saveVaultMeta(meta)
  return { meta, recoveryCode }
}

beforeEach(() => {
  memory.clear()
  lockVault()
})

describe('passphrase policy', () => {
  it('rejects short, simple and repetitive passphrases', () => {
    expect(passphraseProblem('short')).not.toBeNull()
    expect(passphraseProblem('aaaaaaaaaaaa')).not.toBeNull()
    expect(passphraseProblem('password123')).not.toBeNull()
    expect(passphraseProblem('1234567890')).not.toBeNull()
  })
  it('accepts a long phrase and a mixed passphrase', () => {
    expect(passphraseProblem(PASS)).toBeNull()
    expect(passphraseProblem('Tr0ub4dor&3xK')).toBeNull()
    expect(passphraseBits(PASS)).toBeGreaterThan(passphraseBits('abcdefghij'))
  })
})

describe('recovery code', () => {
  it('is 8 groups of 4 and normalises typos', () => {
    const code = generateRecoveryCode()
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/)
    expect(normalizeRecoveryCode(code.toLowerCase())).toBe(normalizeRecoveryCode(code))
    expect(normalizeRecoveryCode('o-i-l')).toBe('011')
    expect(new Set(Array.from({ length: 20 }, generateRecoveryCode)).size).toBe(20)
  })
})

describe('vault lifecycle', () => {
  it('creates, locks and unlocks with the passphrase', async () => {
    await setup()
    expect(isVaultEnabled()).toBe(true)
    expect(isVaultUnlocked()).toBe(true)
    lockVault()
    expect(isVaultUnlocked()).toBe(false)
    await expect(unlockVault({ passphrase: 'wrong wrong wrong' })).rejects.toBeInstanceOf(VaultAuthError)
    expect(isVaultUnlocked()).toBe(false)
    await unlockVault({ passphrase: PASS })
    expect(isVaultUnlocked()).toBe(true)
  })

  it('never stores the key or passphrase in the clear', async () => {
    await setup()
    const stored = memory.get('my-car-vault-v1')!
    expect(stored).not.toContain(PASS)
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual(['createdAt', 'kdf', 'pass', 'recovery', 'v'])
  })

  it('unlocks with the recovery code, tolerant of formatting', async () => {
    const { recoveryCode } = await setup()
    lockVault()
    await unlockVault({ recoveryCode: recoveryCode.toLowerCase().replace(/-/g, ' ') })
    expect(isVaultUnlocked()).toBe(true)
  })

  it('refuses a wrong recovery code', async () => {
    await setup()
    lockVault()
    await expect(unlockVault({ recoveryCode: generateRecoveryCode() })).rejects.toBeInstanceOf(VaultAuthError)
  })

  it('changes the passphrase using the old one, keeping data readable and the recovery code valid', async () => {
    const { recoveryCode } = await setup()
    const sealed = await sealJson({ a: 1 }, 'x')
    await changePassphrase({ passphrase: PASS }, 'a brand new long passphrase', FAST)
    lockVault()
    await expect(unlockVault({ passphrase: PASS })).rejects.toBeInstanceOf(VaultAuthError)
    await unlockVault({ passphrase: 'a brand new long passphrase' })
    expect(await openJson(sealed, 'x')).toEqual({ a: 1 })
    lockVault()
    await unlockVault({ recoveryCode })
    expect(await openJson(sealed, 'x')).toEqual({ a: 1 })
  })

  it('lets the recovery code set a new passphrase after the old one is forgotten', async () => {
    const { recoveryCode } = await setup()
    const sealed = await sealJson('secret', 'k')
    lockVault()
    await changePassphrase({ recoveryCode }, 'another long safe passphrase', FAST)
    await unlockVault({ passphrase: 'another long safe passphrase' })
    expect(await openJson(sealed, 'k')).toBe('secret')
  })

  it('rotating the recovery code invalidates the old one', async () => {
    const { recoveryCode: oldCode } = await setup()
    const newCode = await rotateRecoveryCode(PASS)
    expect(newCode).not.toBe(oldCode)
    lockVault()
    await expect(unlockVault({ recoveryCode: oldCode })).rejects.toBeInstanceOf(VaultAuthError)
    await unlockVault({ recoveryCode: newCode })
    expect(isVaultUnlocked()).toBe(true)
  })

  it('verifies a secret without unlocking', async () => {
    await setup()
    lockVault()
    expect(await verifyVaultSecret({ passphrase: PASS })).toBe(true)
    expect(await verifyVaultSecret({ passphrase: 'nope nope nope' })).toBe(false)
    expect(isVaultUnlocked()).toBe(false)
  })

  it('pauses after repeated wrong attempts, even for the right passphrase', async () => {
    await setup()
    lockVault()
    const t = 5_000_000
    for (let i = 0; i < 5; i++) await expect(unlockVault({ passphrase: 'wrong wrong wrong' }, t)).rejects.toBeInstanceOf(VaultAuthError)
    expect(vaultLockoutRemainingMs(t)).toBe(30_000)
    await expect(unlockVault({ passphrase: PASS }, t + 1000)).rejects.toBeInstanceOf(VaultAuthError)
    expect(isVaultUnlocked()).toBe(false)
    await unlockVault({ passphrase: PASS }, t + 31_000)
    expect(isVaultUnlocked()).toBe(true)
    expect(vaultLockoutRemainingMs(t + 31_000)).toBe(0)
  })

  it('clearing the meta turns the vault off', async () => {
    await setup()
    clearVaultMeta()
    expect(getVaultMeta()).toBeNull()
    expect(isVaultEnabled()).toBe(false)
  })

  it('refuses to create a vault with a weak passphrase', async () => {
    await expect(createVault('short', FAST)).rejects.toThrow()
  })
})

describe('data encryption', () => {
  it('round-trips JSON and binds it to its location', async () => {
    await setup()
    const sealed = await sealJson({ title: 'Ford', n: [1, 2] }, 'cars:1')
    expect(JSON.stringify(sealed)).not.toContain('Ford')
    expect(await openJson(sealed, 'cars:1')).toEqual({ title: 'Ford', n: [1, 2] })
    // A record moved to another id/store must not decrypt.
    await expect(openJson(sealed, 'cars:2')).rejects.toThrow()
  })

  it('uses a fresh IV every time and detects tampering', async () => {
    await setup()
    const a = await sealJson('same', 'k')
    const b = await sealJson('same', 'k')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
    const flipped = { ...a, ct: a.ct.slice(0, -4) + (a.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA') }
    await expect(openJson(flipped, 'k')).rejects.toThrow()
  })

  it('refuses to encrypt or decrypt while locked', async () => {
    await setup()
    const sealed = await sealJson('x', 'k')
    lockVault()
    await expect(sealJson('y', 'k')).rejects.toBeInstanceOf(VaultLockedError)
    await expect(openJson(sealed, 'k')).rejects.toBeInstanceOf(VaultLockedError)
  })

  it('encrypts strings for localStorage and passes plain strings through', async () => {
    await setup()
    const token = await sealString('y0_secrettoken', 'yandex')
    expect(token.startsWith('enc1:')).toBe(true)
    expect(token).not.toContain('secrettoken')
    expect(await openString(token, 'yandex')).toBe('y0_secrettoken')
    expect(await openString('plain', 'yandex')).toBe('plain')
  })
})

describe('encrypted backups', () => {
  const data = { cars: [{ id: 'c', make: 'Ford' }], items: [] }

  it('hides the content and opens on the same unlocked device without a secret', async () => {
    await setup()
    const file = await encryptBackup(data)
    expect(isEncryptedBackup(file)).toBe(true)
    expect(JSON.stringify(file)).not.toContain('Ford')
    expect(await decryptBackup(file)).toEqual(data)
  })

  it('opens elsewhere with the passphrase or the recovery code, and not with a wrong one', async () => {
    const { recoveryCode } = await setup()
    const file = JSON.parse(JSON.stringify(await encryptBackup(data)))
    lockVault()
    memory.clear() // a different device: no vault meta at all
    expect(await decryptBackup(file, { passphrase: PASS })).toEqual(data)
    expect(await decryptBackup(file, { recoveryCode })).toEqual(data)
    await expect(decryptBackup(file, { passphrase: 'wrong wrong wrong' })).rejects.toBeInstanceOf(VaultAuthError)
    await expect(decryptBackup(file)).rejects.toBeInstanceOf(VaultAuthError)
    expect(isVaultUnlocked()).toBe(false)
  })
})
