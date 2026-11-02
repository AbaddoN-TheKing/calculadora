const CACHE_VERSION = 2;
const CACHE_NAME = `kaops-v${CACHE_VERSION}`;
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './data.js',
    './engine.js',
    './snippet.js',
    './tutorials.js',
    './core.js',
    './players.js',
    './operation.js',
    './plan.js',
    './combat.js',
    './more.js',
    './share.js',
    './install.js',
    './nav.js',
    './manifest.json',
    './icon.svg',
    './icon-maskable-512.png',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(Promise.all([
        self.clients.claim(),
        caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))))
    ]));
});

// Cache primeiro, atualiza em segundo plano (stale-while-revalidate). Só pedidos GET.
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request).then((cached) => {
            const network = fetch(e.request).then((res) => {
                if (res && res.status === 200) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
                }
                return res;
            }).catch(() => null);
            return cached || network.then((r) => r || new Response('Offline', { status: 503 }));
        })
    );
});
