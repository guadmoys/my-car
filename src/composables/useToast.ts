import { reactive } from 'vue'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ToastEntry {
  id: number
  message: string
  action?: ToastAction
}

const toasts = reactive<ToastEntry[]>([])
let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function dismiss(id: number): void {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

function show(message: string, action?: ToastAction, durationMs = 4000): void {
  const id = nextId++
  toasts.push({ id, message, action })
  timers.set(
    id,
    setTimeout(() => dismiss(id), durationMs),
  )
}

export function useToast() {
  return { toasts, show, dismiss }
}
