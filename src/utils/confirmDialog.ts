import { alertController } from '@ionic/vue'

export interface ConfirmOptions {
  header?: string
  confirmText?: string
  cancelText?: string
  /** Colours the confirm button as a destructive action. */
  destructive?: boolean
}

/**
 * A yes/no question in Ionic's own alert, in place of the browser's window.confirm,
 * which looks foreign, blocks the page, and is suppressed in some installed-app contexts.
 * Resolves true only when the confirm button is pressed.
 */
export async function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  const alert = await alertController.create({
    header: opts.header,
    message,
    buttons: [
      { text: opts.cancelText ?? 'Отмена', role: 'cancel' },
      { text: opts.confirmText ?? 'Продолжить', role: 'confirm', cssClass: opts.destructive ? 'alert-button-destructive' : undefined },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  return role === 'confirm'
}
