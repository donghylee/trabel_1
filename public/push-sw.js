// 메시지 푸시 알림을 받아 띄우는 서비스 워커 코드.
// vite-plugin-pwa가 만든 서비스 워커(sw.js)가 importScripts로 불러옴 (vite.config.ts의 workbox.importScripts).
// 알림 내용은 서버 함수 supabase/functions/dm-push 가 보냄: { title, body, url, tag }

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'PLAN:J', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

// 알림을 누르면: 열려 있는 앱이 있으면 그 창에서 대화를 열고, 없으면 새로 염
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        client.postMessage({ type: 'open-url', url })
        return client.focus()
      }
      return self.clients.openWindow(url)
    })(),
  )
})
