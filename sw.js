// 1. TETAP PERTAHANKAN PUSH NOTIFICATION ONESIGNAL
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
  console.warn('[SW] OneSignal worker tidak dimuat:', e);
}

// 2. SAAT SW TERINSTAL: Langsung paksa aktif
self.addEventListener('install', event => {
  self.skipWaiting();
});

// 3. SAAT SW AKTIF: Langsung HAPUS SEMUA CACHE LAMA yang pernah ada di HP pengguna
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          return caches.delete(cacheName); // Membunuh semua memori hantu
        })
      );
    })
  );
  self.clients.claim();
});

// 4. SAAT APLIKASI MEMINTA DATA: Mode "Opera Mini" (Network Only)
self.addEventListener('fetch', event => {
  const req = event.request;

  // Biarkan request POST (Simpan Data) berjalan normal ke Google
  if (req.method !== 'GET') {
    return;
  }

  // Tarik data langsung dari server jaringan dengan perintah dilarang cache (no-store)
  event.respondWith(
    fetch(req, { cache: 'no-store' }).catch(err => {
      // Jika HP benar-benar tidak ada sinyal internet, kembalikan error standar
      console.warn('Anda sedang offline atau server tidak merespons.');
    })
  );
});