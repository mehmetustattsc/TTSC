// Offline support: app files are cached; new versions load in the background (network first).
const CACHE = 'ttsc-team-v9';
const FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/store.js', 'js/i18n.js', 'js/config.js', 'js/remote.js', 'js/share.js', 'manifest.webmanifest', 'datenschutz.html', 'afis.html', 'assets/join-qr.svg', 'assets/fonts/Barlow-Regular.woff', 'assets/fonts/Barlow-Medium.woff', 'assets/fonts/Barlow-SemiBold.woff', 'assets/fonts/Barlow-Bold.woff', 'assets/fonts/BarlowCondensed-SemiBold.woff', 'assets/fonts/BarlowCondensed-Bold.woff', 'data/league.json', 'assets/logo.png', 'assets/icon-192.png', 'assets/games/pusula.png', 'assets/games/sancak.png', 'assets/games/petek.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

// Push notifications: show them, and open the right screen when tapped.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'TTSC', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'TTSC', { body: d.body || '', tag: d.tag, renotify: !!d.tag, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: d.url || '#/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL('./' + (e.notification.data && e.notification.data.url || ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    if (w) { w.navigate(target).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(target);
  }));
});
