/* Service worker sederhana: cache aset agar aplikasi bisa dibuka offline (PWA) */
const CACHE = 'aibm-v12';
const ASSETS = ['./', './index.html', './css/styles.css', './js/icons.js', './js/store.js', './js/audio.js', './js/camera.js', './js/engine.js', './js/app.js', './js/screens.js', './js/sim.js', './assets/icon.svg', './assets/apple-touch-icon.png', './assets/icon-192.png', './assets/icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
