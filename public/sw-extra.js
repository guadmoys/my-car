/* Extra service-worker logic, pulled in by the generated worker via importScripts.
 *
 * 1. Background check: on a periodic sync (Chromium, installed PWA) it reads the
 *    upcoming-notification schedule the page keeps in the "my-car-alerts"
 *    IndexedDB and shows whatever has come due and was not shown yet.
 * 2. Tapping a notification focuses the app (or opens it).
 *
 * It never touches the encrypted app database, only that small schedule, which
 * the page leaves empty while encryption is on. */
'use strict'

var ALERT_DB = 'my-car-alerts'
var SYNC_TAG = 'my-car-alerts'

function openAlertDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(ALERT_DB)
    req.onsuccess = function () {
      resolve(req.result)
    }
    req.onerror = function () {
      reject(req.error)
    }
  })
}

function readAll(db, store) {
  return new Promise(function (resolve) {
    if (!db.objectStoreNames.contains(store)) return resolve([])
    var req = db.transaction(store).objectStore(store).getAll()
    req.onsuccess = function () {
      resolve(req.result || [])
    }
    req.onerror = function () {
      resolve([])
    }
  })
}

function markShown(db, keys, now) {
  return new Promise(function (resolve) {
    if (!db.objectStoreNames.contains('shown') || keys.length === 0) return resolve()
    var tx = db.transaction('shown', 'readwrite')
    var store = tx.objectStore('shown')
    keys.forEach(function (key) {
      store.put({ key: key, at: now })
    })
    tx.oncomplete = function () {
      resolve()
    }
    tx.onerror = function () {
      resolve()
    }
  })
}

/** Shows every scheduled notification that is due and not yet shown. Returns how many it showed. */
function showDueNotifications(now) {
  now = now || Date.now()
  return openAlertDb()
    .then(function (db) {
      return Promise.all([readAll(db, 'schedule'), readAll(db, 'shown'), readAll(db, 'meta')]).then(function (res) {
        var enabledMeta = res[2].filter(function (m) {
          return m.k === 'enabled'
        })[0]
        if (!enabledMeta || enabledMeta.v !== true) return 0
        var shown = {}
        res[1].forEach(function (s) {
          shown[s.key] = true
        })
        var icon = new URL('icons/icon-192.png', self.registration.scope).href
        var due = res[0].filter(function (n) {
          return n.at <= now && n.memberKeys.some(function (k) {
            return !shown[k]
          })
        })
        return Promise.all(
          due.map(function (n) {
            return self.registration
              .showNotification(n.title, { body: n.body, icon: icon, badge: icon, tag: n.key, data: { url: self.registration.scope } })
              .then(function () {
                return markShown(db, n.memberKeys, now)
              })
          }),
        ).then(function () {
          return due.length
        })
      })
    })
    .catch(function () {
      return 0
    })
}

self.addEventListener('periodicsync', function (event) {
  if (event.tag === SYNC_TAG) event.waitUntil(showDueNotifications())
})

// The page can also ask for a check (used by tests and "check now").
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'my-car-check-alerts') event.waitUntil(showDueNotifications())
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf(self.registration.scope) === 0 && 'focus' in clients[i]) return clients[i].focus()
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined
    }),
  )
})

// Exposed for unit tests; harmless in the worker.
self.__myCarAlerts = { showDueNotifications: showDueNotifications }
