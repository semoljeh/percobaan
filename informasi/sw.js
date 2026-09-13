// =========================================================
// SERVICE WORKER - PORTAL WALI SANTRI MADASA
// =========================================================

const CACHE_NAME = 'madasa-ortu-v2';

// Daftar file statis yang disimpan ke cache PWA
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  '../asset/logo.png',
  '../asset/logoweb.png',
  '../asset/logowali.png'
];

// 1. Install Service Worker & Simpan Cache
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa SW baru langsung aktif
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. Logika Fetch Data (Aman untuk API Database)
self.addEventListener('fetch', (event) => {
  // PENTING: Jika request menggunakan POST atau mengarah ke Google Apps Script / Drive,
  // biarkan berjalan LIVE dari jaringan (JANGAN DISIMPAN DI CACHE)
  if (event.request.method !== 'GET' || event.request.url.includes('script.google.com') || event.request.url.includes('googleusercontent.com')) {
    return;
  }

  // Untuk file HTML, CSS, JS statis: gunakan strategi Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request, { ignoreSearch: true }).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Abaikan error jika offline
        });
        return response || fetchPromise;
      });
    })
  );
});

// 3. Bersihkan Cache Versi Lama Saat Update
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Hapus cache versi lama
          }
        })
      );
    })
  );
});