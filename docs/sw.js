/* Rota Cepte · © 2026 Mert Turanlıoğlu · Çevrimdışı açılış (önce internet, yoksa kayıtlı kopya) */
const C = "gezi-5.9";
const IND = "gezi-indir"; // "İnternetsiz kullan" ile indirilen il verisi ve fotoğraflar (sürüm değişse de silinmez)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((k) => Promise.all(k.filter((x) => x !== C && x !== IND).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  // Fotoğraflar: indirilmişse telefondan, değilse internetten
  if (u.hostname === "upload.wikimedia.org") {
    e.respondWith(caches.open(IND).then((c) => c.match(r.url, { ignoreVary: true })).then((m) => m || fetch(r)));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const k = res.clone(); caches.open(C).then((c) => c.put(r, k)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("./", { ignoreSearch: true }))));
});
