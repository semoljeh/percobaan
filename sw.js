// OneSignal worker hanya akan berfungsi penuh pada domain yang dikonfigurasi.
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
  console.warn('[SW] OneSignal worker tidak dimuat:', e);
}

const CACHE_NAME = 'madasa-pwa-v16';
const PRECACHE = [
  './',
  './index.html',
  './style.css?v=16',
  './manifest.json',
  './asset/logo.png',
  './asset/logo-192.png',
  './asset/logo-512.png',
  './informasi/index.html',
  './administrasi/spp.html',
  './rapor/rapor_tpq.html',
  './rapor/rapor_ibtidaiyah.html',
  './rapor/rapor_sanawiyah.html'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Jangan pernah intervensi request non-GET atau request Google Apps Script.
  if (req.method !== 'GET' ||
      url.hostname.includes('script.google.com') ||
      url.hostname.includes('script.googleusercontent.com') ||
      url.hostname.includes('google.com')) {
    return;
  }

  // Hanya cache resource origin aplikasi sendiri.
  if (url.origin !== self.location.origin) return;

  const isCodeOrDocument =
    req.destination === 'document' ||
    req.destination === 'script' ||
    req.destination === 'style' ||
    /\.(html|js|css)$/i.test(url.pathname);

  if (isCodeOrDocument) {
    // NETWORK FIRST: update kode langsung terlihat di browser normal.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match(req)) || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
      }
    })());
    return;
  }

  // Aset gambar/font: cache first, lalu jaringan.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    if (fresh && fresh.ok) await cache.put(req, fresh.clone());
    return fresh;
  })());
});
