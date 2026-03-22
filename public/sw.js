// public/sw.js — updated with offline caching
//
// THEORY: Cache strategies
//
// 'Network first, cache fallback' for HTML navigation:
//   → Try network first (fresh content)
//   → If network fails (offline), serve from cache
//   → Best for pages where fresh data matters
//
// 'Cache first' for static assets (_next/static/):
//   → Check cache first (fast)
//   → If not cached, fetch from network and cache it
//   → Best for versioned assets (JS/CSS bundles with hash in filename)
//   → These are safe to cache forever because Next.js changes the filename on each deploy

const CACHE_NAME  = 'taskflow-v1'

// App shell — the minimum files needed to render the app offline
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // activate immediately, don't wait for old tabs
  )
})

// ── Activate: clean up stale caches from previous versions ───────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)  // delete any cache that isn't current version
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())  // take control of all open tabs immediately
  )
})

// ── Fetch: intercept network requests ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle requests to our own origin
  if (url.origin !== location.origin) return

  // Don't intercept non-GET requests (POST to Supabase etc. must go through)
  if (request.method !== 'GET') return

  // Don't intercept Supabase API calls — they need live network data
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) return

  // Static assets: cache first (these filenames are hashed by Next.js)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          // Only cache successful responses
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navigation requests (HTML pages): network first, cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the latest version for offline use
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          // Network failed — serve the cached version
          caches.match(request) || caches.match('/')
        )
    )
    return
  }
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json()
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body:    data.body,
        icon:    data.icon || '/icon-192x192.png',
        badge:   '/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/',
        },
      })
    )
  }
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  )
})