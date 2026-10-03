import { alertController } from '@ionic/vue'
import type { Secret } from './vault'

/**
 * Asks for the passphrase or recovery code of an encrypted backup. One masked
 * field, because people don't know which of the two a file wants; the caller
 * tries it as a passphrase first, then as a recovery code (see backupFile.ts).
 */
export async function askBackupSecret(message = 'Файл зашифрован. Введите пароль шифрования или ключ восстановления.'): Promise<string | null> {
  const alert = await alertController.create({
    header: 'Зашифрованная копия',
    message,
    inputs: [{ name: 'secret', type: 'password', placeholder: 'Пароль или ключ восстановления', attributes: { autocomplete: 'off' } }],
    buttons: [
      { text: 'Отмена', role: 'cancel' },
      { text: 'Открыть', role: 'confirm' },
    ],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss()
  const value = role === 'confirm' ? String(data?.values?.secret ?? '') : ''
  return value.trim() === '' ? null : value
}

/** Interpretations of what the user typed, most likely first. */
export function secretCandidates(input: string, looksLikeRecovery: (s: string) => boolean): Secret[] {
  const list: Secret[] = [{ passphrase: input }]
  if (looksLikeRecovery(input)) list.push({ recoveryCode: input })
  return list
}
