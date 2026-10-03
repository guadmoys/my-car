import { VaultAuthError, decryptBackup, isEncryptedBackup, normalizeRecoveryCode, type EncryptedBackup } from '../security/vault'
import { secretCandidates } from '../security/secretPrompt'

const MAX_TRIES = 3

function looksLikeRecoveryCode(input: string): boolean {
  return /^[0-9A-Z]{32}$/.test(normalizeRecoveryCode(input))
}

/**
 * Opens an encrypted backup: first without a secret (works on the device that
 * made it while unlocked), then by asking the user up to three times.
 * Returns null when the user cancels.
 */
export async function openEncryptedBackup(
  file: EncryptedBackup,
  ask: (message?: string) => Promise<string | null>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await decryptBackup(file) }
  } catch (e) {
    if (!(e instanceof VaultAuthError)) return { ok: false, error: 'Не удалось расшифровать файл — он повреждён' }
  }

  let message: string | undefined
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const input = await ask(message)
    if (input === null) return { ok: false, error: 'Отменено' }
    for (const secret of secretCandidates(input, looksLikeRecoveryCode)) {
      try {
        return { ok: true, data: await decryptBackup(file, secret) }
      } catch (e) {
        if (!(e instanceof VaultAuthError)) return { ok: false, error: 'Не удалось расшифровать файл — он повреждён' }
      }
    }
    message = 'Не подошло. Проверьте пароль или ключ восстановления и попробуйте ещё раз.'
  }
  return { ok: false, error: 'Неверный пароль или ключ восстановления' }
}

/** Parsed JSON from a backup file: returns the readable backup data, decrypting first when the file is encrypted. */
export async function resolveBackupData(
  parsed: unknown,
  ask: (message?: string) => Promise<string | null>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  if (!isEncryptedBackup(parsed)) return { ok: true, data: parsed }
  return openEncryptedBackup(parsed, ask)
}
