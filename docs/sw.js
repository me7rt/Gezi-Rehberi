/* Yoldayız · © 2026 Mert Turanlıoğlu · Çevrimdışı açılış (önce internet, yoksa kayıtlı kopya) */
const C = "gezi-4.4";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const k = res.clone(); caches.open(C).then((c) => c.put(r, k)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("./", { ignoreSearch: true }))));
});
