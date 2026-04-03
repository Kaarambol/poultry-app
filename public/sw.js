const CACHE_NAME = 'poultry-v1';

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brak połączenia – Poultry Manager</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f1f5f9; }
    .card { background: white; border-radius: 16px; padding: 2.5rem 2rem; text-align: center; max-width: 340px; width: 90%; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.3rem; margin: 0 0 0.5rem; color: #1e293b; }
    p { color: #64748b; margin: 0 0 1.5rem; font-size: 0.95rem; line-height: 1.5; }
    button { padding: 0.6rem 1.4rem; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 500; }
    button:active { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Brak połączenia</h1>
    <p>Nie ma zasięgu. Wróć na stronę gdy złapiesz internet — dane nie zostały utracone.</p>
    <button onclick="location.reload()">Spróbuj ponownie</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Tylko GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Żądania API — zawsze przez sieć, bez cache
  if (url.pathname.startsWith('/api/')) return;

  // Pliki statyczne Next.js (_next/static) — cache-first (mają hash w nazwie)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Obrazki i pliki publiczne — cache-first
  if (
    url.pathname.startsWith('/icon') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Nawigacja (strony HTML) — network-first, fallback na stronę offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );
    return;
  }
});
