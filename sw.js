/* Service Worker — إدارة دخل السائق (offline-first app shell) */
'use strict';
const CACHE = 'driver-income-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/db.js',
  './js/pro-codes.js',
  './js/core.js',
  './js/pro.js',
  './js/ui.js',
  './js/charts.js',
  './js/views-home.js',
  './js/views-addday.js',
  './js/views-wallets.js',
  './js/views-analytics.js',
  './js/views-archive.js',
  './js/views-settings.js',
  './js/app.js',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const a of ASSETS) {
      try { await cache.add(a); } catch (err) { /* skip missing asset */ }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

/* Stale-while-revalidate: instant load from cache, refresh in background */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then(res => {
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || network;
  })());
});
