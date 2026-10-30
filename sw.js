// Nástroje – service worker. Při větší změně zvyš VERZE.
const VERZE = 'ps-v6';
const ZAKLAD = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERZE).then(c => c.addAll(ZAKLAD)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERZE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});
// Nejdřív síť (vždy aktuální verze), při výpadku z mezipaměti.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith('http')) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const kopie = res.clone();
        caches.open(VERZE).then(c => c.put(r, kopie));
      }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true })
      .then(m => m || (r.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  );
});
