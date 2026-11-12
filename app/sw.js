/* Service worker: aplikasi tetap bisa dibuka saat sinyal lemah (PWA).
   Strategi: jaringan dulu (selalu versi terbaru), cadangan dari cache bila offline. */
const CACHE = 'aibm-v3.1.0';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/apple-touch-icon.png', './css/app.css','./js/core/bus.js','./js/core/icons.js','./js/core/router.js','./js/core/store.js','./js/core/ui.js','./js/core/util.js','./js/main.js','./js/screens/babycam.js','./js/screens/home.js','./js/screens/journal.js','./js/screens/live.js','./js/screens/more.js','./js/screens/night.js','./js/screens/report.js','./js/screens/setup.js','./js/screens/shared.js','./js/services/alarm.js','./js/services/audio.js','./js/services/babyUnit.js','./js/services/control.js','./js/services/detector.js','./js/services/feed.js','./js/services/insights.js','./js/services/link.js','./js/services/monitor.js','./js/services/reminders.js','./js/services/sim.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
/* Ketuk notifikasi alarm → buka aplikasi */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
