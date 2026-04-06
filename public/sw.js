const BUILD_ID   = 'a947c56'
const CACHE_NAME = `taskflow-shell-${BUILD_ID}`
const SHELL_URLS = ['/']

self.addEventListener('install', event => {
  console.log('[sw] install — build:', BUILD_ID)
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  console.log('[sw] activate — build:', BUILD_ID)
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(k => k.startsWith('taskflow-shell-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )

      await self.clients.claim()

      // Notify all tabs to reload (FIX 4: force restart on new release)
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        client.postMessage({ type: 'SW_UPDATED', buildId: BUILD_ID })
      }
    })()
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url         = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/rest/') ||
      url.hostname.includes('supabase.co')) {
    return
  }

 if (url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)))
    return
  }
 event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response))
          }
        }).catch(() => {})
        return cached
      }
      return fetch(request).catch(() => caches.match('/'))
    })
  )
})

self.addEventListener('push', event => {
  if (!event.data) return

  let data
  try { data = event.data.json() }
  catch { data = { title: 'taskflow', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'taskflow', {
      body             : data.body  ?? '',
      icon             : data.icon  ?? '/icon-192x192.png',
      badge            : '/icon-192x192.png',
      tag              : 'taskflow-digest',
      renotify         : false,
      requireInteraction: false,
      data             : { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(c => c.url.includes(self.location.origin))
        if (existing) { existing.focus(); existing.navigate(url); return }
        return self.clients.openWindow(url)
      })
  )
})