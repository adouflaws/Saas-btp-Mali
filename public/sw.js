const CACHE = 'btp-mali-v2'

// Pages pré-cachées au premier lancement
const SHELL = [
  '/dashboard',
  '/dashboard/chantiers',
  '/dashboard/equipes/pointage',
  '/dashboard/carburant',
]

/* ── Install ── */
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))
  )
})

/* ── Activate : nettoyer les anciens caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requêtes non-GET et cross-origin Supabase
  if (request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return
  // Ignorer les données RSC (Next.js App Router)
  if (url.pathname.startsWith('/_next/data')) return
  if (url.searchParams.has('_rsc')) return

  // Assets statiques Next.js → cache first (immuables)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        })
      )
    )
    return
  }

  // Images et fonts → cache first
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        }).catch(() => cached || new Response('', { status: 503 }))
      )
    )
    return
  }

  // Navigation HTML → network first, fallback cache
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached ||
          caches.match('/dashboard').then(dash =>
            dash || new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hors ligne — BTP Mali</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#1c1c1c;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;text-align:center}h1{color:#f97316}p{color:#9ca3af}</style></head><body><div><h1>🏗️ BTP Mali</h1><p>Vous êtes hors ligne.</p><p>Reconnectez-vous pour accéder au tableau de bord.</p></div></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          )
        )
      )
  )
})
