// 318 LEGAACY Marketplace - Service Worker
const STATIC_CACHE = '318-legaacy-static-v3'
const DYNAMIC_CACHE = '318-legaacy-dynamic-v3'

// Ne précharger que des fichiers réellement statiques.
// Les pages et les fichiers Next.js changent à chaque déploiement : les
// conserver ici peut mélanger deux versions du site et provoquer un écran
// « Quelque chose s'est mal passé ».
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// Install - pre-cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API calls and auth - always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // Skip Supabase and external requests
  if (!url.origin.includes(self.location.origin)) {
    return
  }

  // Toujours laisser le navigateur et Next.js récupérer la version courante.
  // En particulier, ne jamais répondre avec un ancien chunk JavaScript.
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.startsWith('/_next/')
  ) {
    return
  }

  // Images - Cache First
  if (
    request.destination === 'image' ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Toutes les autres requêtes restent gérées normalement par le navigateur.
})

// Handle push notifications (future)
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '318 LEGAACY', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
