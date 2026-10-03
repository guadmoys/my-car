// A rapid double-tap on a sheet's "Готово" fires its click handler twice
// before the first async store write resolves and the sheet closes — there's
// no per-sheet "already submitting" state, so both taps go through and
// create two records from one intended save. This is the single shared lock
// every create/update handler goes through: the second tap is simply
// ignored rather than producing a visible duplicate (or, for edits, a
// harmless redundant write).
let isSubmitting = false

export async function submitOnce(fn: () => Promise<void>): Promise<void> {
  if (isSubmitting) return
  isSubmitting = true
  try {
    await fn()
  } finally {
    isSubmitting = false
  }
}
