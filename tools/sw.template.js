// 離線快取（tools/build_sw.js 產生，不要手改 sw.js）
const VERSION = '__VERSION__';
const CACHE = 'office-idle-' + VERSION;
const FILES = __FILES__;

self.addEventListener('install', e => {
  // 一個一個抓，失敗的跳過（不要因為一張圖讓整個離線功能裝不起來）
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('office-idle-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // 網頁本身：有網路就拿最新，沒網路用快取
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); return r; }).catch(() => caches.match('./', { ignoreSearch: true })));
    return;
  }
  // 程式、樣式：有網路拿最新（避免新舊版混用），沒網路用快取
  const pth = new URL(req.url).pathname;
  if (/\.(js|css|webmanifest)$/.test(pth)) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req.url.split('?')[0], cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // 圖片：先用快取（忽略 ?v=），沒有才上網抓並存起來
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req.url.split('?')[0], cp)); }
    return r;
  })));
});
self.addEventListener('message', e => { if (e.data === 'version') e.source && e.source.postMessage({ version: VERSION }); });
