const BUILD_ID = '6161100' 
const CACHE_NAME = `taskflow-${BUILD_ID}`

self.addEventListener('install', (event) => {
  console.log('[sw] installing build:', BUILD_ID)
  self.skipWaiting()
})


self.addEventListener('activate', (event) => {
  console.log('[sw] activating build:', BUILD_ID)
  event.waitUntil(
    (async () => {
      await self.clients.claim()

      // Get all open tabs
      const allClients = await self.clients.matchAll({
        type            : 'window',
        includeUncontrolled: true,
      })

      console.log('[sw] reloading', allClients.length, 'tab(s)')

      for (const client of allClients) {
        client.postMessage({ type: 'SW_UPDATED', buildId: BUILD_ID })
      }
    })()
  )
})

self.addEventListener('fetch', (event) => {

  if (!event.request.url.startsWith(self.location.origin)) return
})


self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'taskflow', body: event.data.text() }
  }

  const title   = data.title ?? 'taskflow'
  const options = {
    body             : data.body ?? '',
    icon             : data.icon ?? '/icon-192x192.png',
    badge            : '/icon-192x192.png',
    tag              : 'taskflow-digest',  
    renotify         : false,
    requireInteraction: false,
    data             : { url: data.url ?? '/' },
    actions          : [
      { action: 'open', title: 'open app' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Focus existing tab if open
        const existing = clients.find(c => c.url.includes(self.location.origin))
        if (existing) {
          existing.focus()
          existing.navigate(url)
          return
        }
        // Otherwise open a new tab
        return self.clients.openWindow(url)
      })
  )
})