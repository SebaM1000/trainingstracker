// Service Worker: speichert die App für den Offline-Betrieb.
// Nach Änderungen an Dateien VERSION erhöhen, damit Geräte die neue Fassung laden.
const VERSION = 'v1.9.0';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/core/store.js', './js/core/registry.js', './js/core/ui.js', './js/core/charts.js',
  './js/core/dates.js', './js/core/icons.js',
  './js/science/goals.js', './js/science/strength.js', './js/science/endurance.js', './js/science/load.js',
  './js/science/coach.js', './js/science/references.js', './js/data/exercises.js', './js/data/meals.js',
  './js/modules/heute.js', './js/modules/kraft.js', './js/modules/ausdauer.js',
  './js/modules/fortschritt.js', './js/modules/profil.js', './js/modules/wissen.js',
  './js/modules/garmin.js', './js/modules/abend.js', './js/modules/ernaehrung.js', './js/science/nutrition.js', './js/science/garmin.js', './js/science/readiness.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Netz zuerst (damit Updates sofort ankommen), bei fehlender Verbindung aus dem Cache
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
