import * as db from '../db/database'
import { clearSnapshots } from './autoBackup'
import { disableLock } from './appLock'
import { protectStoredSecrets, unprotectStoredSecrets } from './cloudSync'
import {
  VaultAuthError,
  clearVaultMeta,
  createVault,
  isVaultEnabled,
  isVaultUnlocked,
  lockVault,
  saveVaultMeta,
  unlockVault,
  verifyVaultSecret,
  type CreatedVault,
  type KdfParams,
} from './vault'

/** Step 1 of turning encryption on: derives the keys and returns the recovery code to show. Nothing is saved yet. */
export async function prepareEncryption(passphrase: string, kdf?: KdfParams): Promise<CreatedVault> {
  if (isVaultEnabled()) throw new Error('Шифрование уже включено')
  return createVault(passphrase, kdf)
}

/** Abandons a prepared vault (user backed out before confirming they saved the recovery code). */
export function cancelPreparedEncryption(): void {
  if (!isVaultEnabled()) lockVault()
}

/**
 * Step 2: after the user confirmed they saved the recovery code, encrypts
 * everything that is stored. If re-encryption fails, nothing is left half-on:
 * the keys are discarded and the data stays exactly as it was.
 */
export async function commitEncryption(created: CreatedVault, onProgress?: (done: number, total: number) => void): Promise<void> {
  saveVaultMeta(created.meta)
  try {
    await db.reencryptAll('seal', onProgress)
  } catch (e) {
    clearVaultMeta()
    lockVault()
    throw e
  }
  // Older local safety copies hold the data in the clear.
  await clearSnapshots()
  await protectStoredSecrets()
  // The vault passphrase replaces the screen PIN at launch; leaving both would mean two prompts and a weaker, redundant gate.
  disableLock()
}

/** Finishes an encryption run that was interrupted (records still in the clear while the vault is on). */
export async function resumeInterruptedMigration(): Promise<void> {
  if (!isVaultEnabled() || !isVaultUnlocked()) return
  const { plain } = await db.countRecords()
  if (plain > 0) await db.reencryptAll('seal')
}

/** Decrypts everything back and removes the vault. Needs the passphrase (or recovery code) again. */
export async function disableEncryption(
  secret: { passphrase: string } | { recoveryCode: string },
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!(await verifyVaultSecret(secret))) {
    throw new VaultAuthError('passphrase' in secret ? 'Неверный пароль' : 'Неверный ключ восстановления')
  }
  if (!isVaultUnlocked()) await unlockVault(secret)
  // Decrypt first: if this throws, the vault and the encrypted data stay intact.
  await db.reencryptAll('unseal', onProgress)
  await unprotectStoredSecrets()
  clearVaultMeta()
  lockVault()
  // Copies sealed under the removed key can no longer be read.
  await clearSnapshots()
}
