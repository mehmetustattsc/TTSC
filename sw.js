// Offline support: app files are cached; new versions load in the background (network first).
const CACHE = 'ttsc-team-v6';
const FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/store.js', 'js/i18n.js', 'js/config.js', 'js/remote.js', 'manifest.webmanifest', 'datenschutz.html', 'assets/fonts/Barlow-Regular.woff', 'assets/fonts/Barlow-Medium.woff', 'assets/fonts/Barlow-SemiBold.woff', 'assets/fonts/Barlow-Bold.woff', 'assets/fonts/BarlowCondensed-SemiBold.woff', 'assets/fonts/BarlowCondensed-Bold.woff', 'data/league.json', 'assets/logo.png', 'assets/icon-192.png', 'assets/games/pusula.png', 'assets/games/sancak.png', 'assets/games/petek.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
