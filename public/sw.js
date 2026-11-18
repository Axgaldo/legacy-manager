/* Service worker de Legacy Manager.
 *
 * Estrategia:
 * - Navegación: red primero y, si falla (sin cobertura), la última copia del
 *   index guardada en caché. Así nunca se sirve una versión vieja estando online.
 * - Recursos con hash (`assets/`) e iconos: caché primero; el nombre cambia en
 *   cada build, así que no hay riesgo de quedarse con código antiguo.
 * - Todo lo de otros dominios (Firebase, Google) pasa sin tocar: los datos
 *   siempre van a la red.
 *
 * El nombre de la caché incluye la versión de la app (`sw.js?v=1.17.0`) y al
 * activarse se borran las cachés anteriores.
 */

const BASE = '/legacy-manager/'
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `legacy-manager-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    // Guardamos el shell; si falla (instalación sin red) no bloqueamos.
    await cache.addAll([BASE]).catch(() => undefined)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith('legacy-manager-') && key !== CACHE)
        .map((key) => caches.delete(key)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) {
          // Todas las rutas SPA devuelven el mismo index: se guarda una sola
          // copia bajo la base para no duplicar HTML en cada URL visitada.
          cache.put(BASE, response.clone())
        }
        return response
      } catch {
        return (await cache.match(BASE))
          || new Response('Sin conexión y sin copia guardada de la aplicación.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
      }
    })())
    return
  }

  const isStatic = url.pathname.startsWith(`${BASE}assets/`)
    || /\.(?:png|svg|webmanifest|ico)$/.test(url.pathname)
  if (!isStatic) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  })())
})
