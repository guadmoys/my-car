import 'fake-indexeddb/auto'
import swSource from '../../../public/sw-extra.js?raw'
import { beforeEach, describe, expect, it } from 'vitest'
import { markShown, resetAlertStore, setMeta, writeSchedule, readShown } from '../alertStore'

type Handler = (event: Record<string, unknown>) => void

/** Evaluates public/sw-extra.js against a fake worker scope, the way the browser would. */
function loadWorker(clients: Record<string, unknown> = { matchAll: async () => [], openWindow: async () => undefined }) {
  const handlers: Record<string, Handler> = {}
  const shown: { title: string; options: Record<string, unknown> }[] = []
  const self = {
    registration: {
      scope: 'https://example.test/my-car/',
      showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }),
    },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    clients,
  } as Record<string, unknown>
  new Function('self', 'indexedDB', 'URL', swSource)(self, indexedDB, URL)
  const api = self.__myCarAlerts as { showDueNotifications: (now?: number) => Promise<number> }
  return { handlers, shown, api }
}

const note = (key: string, at: number, members = [key]) => ({ key: `n:${key}`, carId: 'c', at, title: `T ${key}`, body: `B ${key}`, memberKeys: members })

beforeEach(async () => {
  await resetAlertStore()
})

describe('service worker background check', () => {
  it('shows what is due, once, and not what is still ahead', async () => {
    await setMeta('enabled', true)
    await writeSchedule([note('a', 1000), note('b', 5000)])
    const sw = loadWorker()
    expect(await sw.api.showDueNotifications(2000)).toBe(1)
    expect(sw.shown.map((s) => s.title)).toEqual(['T a'])
    expect(await sw.api.showDueNotifications(2000)).toBe(0) // already shown
    expect(await sw.api.showDueNotifications(6000)).toBe(1)
    expect(sw.shown.map((s) => s.title)).toEqual(['T a', 'T b'])
    expect((await readShown()).has('a')).toBe(true)
  })

  it('does nothing while notifications are off', async () => {
    await setMeta('enabled', false)
    await writeSchedule([note('a', 1000)])
    const sw = loadWorker()
    expect(await sw.api.showDueNotifications(2000)).toBe(0)
    expect(sw.shown).toEqual([])
  })

  it('skips a note whose alerts the page already delivered', async () => {
    await setMeta('enabled', true)
    await writeSchedule([note('a', 1000, ['x', 'y'])])
    await markShown(['x', 'y'], 1500)
    const sw = loadWorker()
    expect(await sw.api.showDueNotifications(2000)).toBe(0)
  })

  it('still shows a merged note if only some of its alerts were delivered', async () => {
    await setMeta('enabled', true)
    await writeSchedule([note('a', 1000, ['x', 'y'])])
    await markShown(['x'], 1500)
    const sw = loadWorker()
    expect(await sw.api.showDueNotifications(2000)).toBe(1)
  })

  it('reacts to a periodic sync with its tag and to an explicit check message, and ignores others', async () => {
    await setMeta('enabled', true)
    await writeSchedule([note('a', 1)])
    const sw = loadWorker()
    const waits: Promise<unknown>[] = []
    const mk = (extra: Record<string, unknown>) => ({ waitUntil: (p: Promise<unknown>) => void waits.push(p), ...extra })
    sw.handlers.periodicsync(mk({ tag: 'something-else' }))
    expect(waits).toHaveLength(0)
    sw.handlers.periodicsync(mk({ tag: 'my-car-alerts' }))
    await Promise.all(waits)
    expect(sw.shown).toHaveLength(1)
    sw.handlers.message(mk({ data: { type: 'my-car-check-alerts' } }))
    expect(waits).toHaveLength(2)
  })

  it('survives a missing alerts database without throwing', async () => {
    const sw = loadWorker()
    await expect(sw.api.showDueNotifications(10)).resolves.toBe(0)
  })

  it('opens the app when a notification is tapped and no window exists', async () => {
    let opened: string | undefined
    const sw = loadWorker({ matchAll: async () => [], openWindow: async (url: string) => void (opened = url) })
    let closed = false
    const waits: Promise<unknown>[] = []
    sw.handlers.notificationclick({
      notification: { close: () => (closed = true), data: { url: 'https://example.test/my-car/' } },
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    })
    await Promise.all(waits)
    expect(closed).toBe(true)
    expect(opened).toBe('https://example.test/my-car/')
  })

  it('focuses an already open app window instead of opening another', async () => {
    let focused = false
    let opened = false
    const sw = loadWorker({
      matchAll: async () => [{ url: 'https://example.test/my-car/?x=1', focus: async () => void (focused = true) }],
      openWindow: async () => void (opened = true),
    })
    const waits: Promise<unknown>[] = []
    sw.handlers.notificationclick({ notification: { close: () => undefined, data: {} }, waitUntil: (p: Promise<unknown>) => void waits.push(p) })
    await Promise.all(waits)
    expect(focused).toBe(true)
    expect(opened).toBe(false)
  })
})
