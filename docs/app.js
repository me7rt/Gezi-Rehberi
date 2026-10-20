/* Gezi Rehberi: 81 il, canlı konum, Vikipedi'den foto ve bilgi. */
(function () {
  "use strict";

  const SVG = {
    t: '<path d="M4 20h16M6 20v-7M18 20v-7M5 13h14M7 13a5 5 0 0 1 10 0M12 4v4"/>',
    d: '<path d="M3 19l6-9 4 6 3-4 5 7z"/><circle cx="17" cy="6" r="2"/>',
    m: '<path d="M3 9l9-5 9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 20h18"/>',
    c: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    s: '<path d="M3 20h18M5 20V10l4-3 4 3v10M13 20v-7l3-2 3 2v7"/>'
  };
  const icon = (k, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[k] || SVG.t}</svg>`;
  const CATS = {
    t: { ad: "Tarihi", renk: "#1f4fa3" },
    d: { ad: "Doğa & Manzara", renk: "#2f7d5b" },
    m: { ad: "Müze", renk: "#13707a" },
    c: { ad: "Çarşı & Lezzet", renk: "#c2462e" },
    s: { ad: "Şehir & Semt", renk: "#7a3f8c" }
  };

  const ILLER = window.ILLER;
  const IL_ADLARI = Object.keys(ILLER).sort((a, b) => a.localeCompare(b, "tr"));
  const $ = (id) => document.getElementById(id);

  // ---------- küçük yardımcılar ----------
  const store = {
    get(k) { try { const v = JSON.parse(localStorage.getItem(k)); return v && Date.now() - v.t < 7 * 864e5 ? v.d : null; } catch { return null; } },
    set(k, d) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch {} }
  };
  function km(a, b) {
    const R = 6371, r = (x) => (x * Math.PI) / 180;
    const dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmt = (d) => (d < 1 ? Math.round(d * 100) * 10 + " m" : d < 100 ? d.toFixed(1).replace(".", ",") + " km" : Math.round(d) + " km");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ---------- Vikipedi ----------
  const API = "https://tr.wikipedia.org/w/api.php";
  async function wiki(titles, { full = true } = {}) {
    const out = {}, need = [];
    for (const t of titles) {
      const c = store.get((full ? "wk2:" : "wc:") + t);
      if (c) out[t] = c; else need.push(t);
    }
    const size = full ? 20 : 50;
    for (let i = 0; i < need.length; i += size) {
      const part = need.slice(i, i + size);
      const p = new URLSearchParams({
        action: "query", format: "json", formatversion: "2", redirects: "1", origin: "*",
        prop: full ? "coordinates|pageimages|extracts|info|pageprops" : "coordinates",
        colimit: "max", titles: part.join("|")
      });
      if (full) {
        p.set("exintro", "1"); p.set("explaintext", "1"); p.set("exlimit", "20");
        p.set("piprop", "thumbnail"); p.set("pithumbsize", "900"); p.set("pilimit", "20"); p.set("inprop", "url"); p.set("ppprop", "wikibase_item");
      }
      let j;
      try { j = await (await fetch(API + "?" + p)).json(); } catch { continue; }
      const q = j.query || {};
      const map = {};
      part.forEach((t) => (map[t] = t));
      (q.normalized || []).forEach((n) => Object.keys(map).forEach((k) => map[k] === n.from && (map[k] = n.to)));
      (q.redirects || []).forEach((n) => Object.keys(map).forEach((k) => map[k] === n.from && (map[k] = n.to)));
      const pages = {};
      (q.pages || []).forEach((pg) => (pages[pg.title] = pg));
      for (const t of part) {
        const pg = pages[map[t]];
        if (!pg || pg.missing) { out[t] = { yok: true }; continue; }
        const v = pageInfo(pg);
        out[t] = v;
        store.set((full ? "wk2:" : "wc:") + t, v);
      }
    }
    return out;
  }


  function pageInfo(pg) {
    const co = pg.coordinates && pg.coordinates[0];
    return {
      baslik: pg.title,
      lat: co ? co.lat : null, lng: co ? co.lon : null,
      foto: pg.thumbnail ? pg.thumbnail.source : null,
      metin: pg.extract || "",
      qid: pg.pageprops && pg.pageprops.wikibase_item || null,
      url: pg.fullurl || "https://tr.wikipedia.org/wiki/" + encodeURIComponent(pg.title)
    };
  }
  async function getJSON(url, params) {
    try { return await (await fetch(url + "?" + new URLSearchParams({ format: "json", origin: "*", ...params }))).json(); }
    catch { return null; }
  }
  const filePath = (f) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f.replace(/^(File|Dosya):/, "")) + "?width=900";
  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
  }

  // Vikipedi'de bulunamayan yeri arayarak bul (ilin yakınında olmalı)
  async function searchPlace(p) {
    const j = await getJSON(API, {
      action: "query", formatversion: "2", generator: "search", gsrsearch: p.w + " " + p.il, gsrlimit: "3", gsrnamespace: "0",
      prop: "coordinates|pageimages|extracts|info|pageprops", exintro: "1", explaintext: "1", exlimit: "3",
      piprop: "thumbnail", pithumbsize: "900", inprop: "url", ppprop: "wikibase_item", colimit: "max"
    });
    const pages = ((j && j.query && j.query.pages) || []).sort((a, b) => a.index - b.index);
    const c = ilMerkez[p.il];
    const ok = pages.find((pg) => { const co = pg.coordinates && pg.coordinates[0]; return co && (!c || km(c, { lat: co.lat, lng: co.lon }) < 120); });
    if (ok) Object.assign(p, pageInfo(ok), { yok: false });
  }
  // Fotoğrafı olmayanlar: önce Vikiveri (Wikidata) resmi, sonra konumun yakınındaki Commons fotoğrafı
  async function wikidataPhotos(list) {
    const need = list.filter((p) => !p.foto && p.qid);
    for (let i = 0; i < need.length; i += 50) {
      const part = need.slice(i, i + 50);
      const j = await getJSON("https://www.wikidata.org/w/api.php", { action: "wbgetentities", ids: part.map((p) => p.qid).join("|"), props: "claims" });
      const ents = (j && j.entities) || {};
      part.forEach((p) => {
        const c = ents[p.qid] && ents[p.qid].claims && ents[p.qid].claims.P18;
        const f = c && c[0] && c[0].mainsnak && c[0].mainsnak.datavalue && c[0].mainsnak.datavalue.value;
        if (f) p.foto = filePath(f);
      });
    }
  }
  async function nearbyPhoto(p) {
    const j = await getJSON("https://commons.wikimedia.org/w/api.php", {
      action: "query", list: "geosearch", gscoord: p.lat + "|" + p.lng, gsradius: "400", gsnamespace: "6", gslimit: "10"
    });
    const f = ((j && j.query && j.query.geosearch) || []).find((g) => /\.(jpe?g)$/i.test(g.title));
    if (f) p.foto = filePath(f.title);
  }
  async function improve(list, redraw) {
    await pool(list.filter((p) => p.yok), 4, searchPlace); redraw();
    await wikidataPhotos(list); redraw();
    await pool(list.filter((p) => !p.foto && p.lat != null), 4, nearbyPhoto); redraw();
  }

  // ---------- durum ----------
  let me = null;            // {lat,lng,acc}
  let watchId = null;
  let ilMerkez = {};        // il -> {lat,lng}
  let current = null;       // {mode:"il", il} | {mode:"near"}
  let places = [];          // gösterilen yerler
  let cat = "hepsi";
  let open = null;          // açık yer
  let map = null, layer = null, meMarker = null, fitted = false;

  // ---------- konum ----------
  function startLocation(cb) {
    if (!navigator.geolocation) { toast("Bu cihaz konumu desteklemiyor."); return; }
    if (watchId !== null) { cb && cb(); return; }
    let first = true;
    $("locText").textContent = "Konum aranıyor…";
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        me = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        $("locBtn").classList.add("on");
        $("locText").textContent = "Konum açık";
        onMove();
        if (first) { first = false; cb && cb(); }
      },
      (err) => {
        watchId = null;
        $("locBtn").classList.remove("on");
        $("locText").textContent = "Konum kapalı";
        toast(err.code === 1 ? "Konum izni verilmedi. Ayarlardan izin verebilirsin." : "Konum bulunamadı, tekrar dene.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }
  let moveTimer = null;
  function onMove() {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (!$("city").hidden) { renderList(); drawMe(); }
      if (open) renderFacts(open);
      if (!$("home").hidden) renderIls();
    }, 300);
  }

  // ---------- ana sayfa ----------
  function renderIls() {
    const q = $("search").value.trim().toLocaleLowerCase("tr");
    let names = IL_ADLARI.filter((n) => n.toLocaleLowerCase("tr").includes(q));
    if (me && Object.keys(ilMerkez).length) {
      names = names.slice().sort((a, b) => (ilMerkez[a] ? km(me, ilMerkez[a]) : 1e9) - (ilMerkez[b] ? km(me, ilMerkez[b]) : 1e9));
    }
    $("ilList").innerHTML = names.map((n) => {
      const d = me && ilMerkez[n] ? fmt(km(me, ilMerkez[n])) : ILLER[n].length + " yer";
      return `<li><button data-il="${esc(n)}"><span>${esc(n)}</span><small>${d}</small></button></li>`;
    }).join("");
  }
  async function loadIlMerkez() {
    const t = IL_ADLARI.map((n) => n + " ili");
    const r = await wiki(t, { full: false });
    IL_ADLARI.forEach((n) => { const v = r[n + " ili"]; if (v && v.lat != null) ilMerkez[n] = { lat: v.lat, lng: v.lng }; });
    renderIls();
  }

  // ---------- şehir ekranı ----------
  function show(view) {
    $("home").hidden = view !== "home";
    $("city").hidden = view !== "city";
    $("back").hidden = view === "home";
    window.scrollTo(0, 0);
  }
  function goHome() {
    current = null; show("home");
    $("eyebrow").textContent = "Gezi Rehberi"; $("title").textContent = "Nereye gidiyorsun?";
    renderIls();
  }
  async function openIl(il) {
    current = { mode: "il", il }; cat = "hepsi"; fitted = false;
    $("eyebrow").textContent = "Gezilecek yerler"; $("title").textContent = il;
    places = ILLER[il].map((p) => ({ ...p, il }));
    show("city"); ensureMap(); renderChips(); renderList(); drawPins();
    await fill(places);
  }
  async function openNear() {
    if (!me) { startLocation(openNear); return; }
    if (!Object.keys(ilMerkez).length) await loadIlMerkez();
    const near = Object.keys(ilMerkez).sort((a, b) => km(me, ilMerkez[a]) - km(me, ilMerkez[b])).slice(0, 3);
    if (!near.length) { toast("İnternet bağlantını kontrol et."); return; }
    current = { mode: "near" }; cat = "hepsi"; fitted = false;
    $("eyebrow").textContent = "Sana en yakın"; $("title").textContent = "Yakınımdaki yerler";
    places = near.flatMap((il) => ILLER[il].map((p) => ({ ...p, il })));
    show("city"); ensureMap(); renderChips(); renderList(); drawPins();
    await fill(places);
  }
  const KEEP = ["baslik", "lat", "lng", "foto", "metin", "url", "qid", "yok"];
  async function fill(list) {
    $("sortInfo").textContent = "Bilgiler yükleniyor…";
    const todo = list.filter((p) => { const c = store.get("wf:" + p.w + "|" + p.il); if (c) { Object.assign(p, c); return false; } return true; });
    const redraw = () => { renderList(); drawPins(); if (open && todo.includes(open)) openDetail(open); };
    if (todo.length) {
      const r = await wiki(todo.map((p) => p.w));
      todo.forEach((p) => Object.assign(p, r[p.w] || {}));
      redraw();
      await improve(todo, redraw);
      todo.filter((p) => p.baslik || p.yok).forEach((p) => { const o = {}; KEEP.forEach((k) => (o[k] = p[k])); store.set("wf:" + p.w + "|" + p.il, o); });
    }
    $("sortInfo").textContent = "";
    renderList(); drawPins();
  }
  const visible = () => places.filter((p) => cat === "hepsi" || p.k === cat);
  const dist = (p) => (me && p.lat != null ? km(me, p) : null);

  function renderChips() {
    const ks = [...new Set(places.map((p) => p.k))];
    const all = [["hepsi", "Hepsi", null], ...ks.map((k) => [k, CATS[k].ad, CATS[k].renk])];
    $("chips").innerHTML = all.map(([k, ad, r]) =>
      `<button data-k="${k}" aria-pressed="${cat === k}">${r ? `<span class="dot" style="background:${r}"></span>` : ""}${ad}</button>`).join("");
  }
  function renderList() {
    const items = visible().slice();
    if (me) items.sort((a, b) => (dist(a) ?? 1e9) - (dist(b) ?? 1e9));
    $("count").textContent = items.length + " yer";
    if (!$("sortInfo").textContent.includes("yükleniyor")) $("sortInfo").textContent = me ? "Sana en yakından sıralı" : "Konumu aç, mesafeyi gör";
    $("list").innerHTML = items.map((p) => {
      const i = places.indexOf(p), d = dist(p);
      const th = p.foto ? `style="background-image:url('${esc(p.foto)}')"` : `style="background:${CATS[p.k].renk}"`;
      return `<li><button class="row" data-i="${i}">
        <span class="thumb" ${th}>${p.foto ? "" : icon(p.k, 24)}</span>
        <span><b>${esc(p.baslik || p.w)}</b><small>${CATS[p.k].ad}${current.mode === "near" ? " · " + esc(p.il) : ""}</small></span>
        <span class="km">${d != null ? fmt(d) : ""}</span></button></li>`;
    }).join("");
  }

  // ---------- harita ----------
  function ensureMap() {
    if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([39, 35], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap"
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  function drawPins() {
    layer.clearLayers();
    const pts = [];
    visible().forEach((p) => {
      if (p.lat == null) return;
      const m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: "", html: `<div class="pin" style="background:${CATS[p.k].renk}">${icon(p.k, 16)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
        title: p.baslik || p.w, alt: p.baslik || p.w
      }).on("click", () => openDetail(p));
      m.addTo(layer); pts.push([p.lat, p.lng]);
    });
    drawMe();
    if (current && current.mode === "near" && me) pts.push([me.lat, me.lng]);
    if (pts.length && !fitted) { map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 }); fitted = pts.length > 2; }
    setTimeout(() => map.invalidateSize(), 50);
  }
  function drawMe() {
    if (!map || !me) return;
    if (!meMarker) meMarker = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: "", html: '<div class="me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
    else meMarker.setLatLng([me.lat, me.lng]);
  }

  // ---------- detay ----------
  function renderFacts(p) {
    const d = dist(p);
    $("dFacts").innerHTML =
      (d != null ? `<span>Uzaklık <strong>${fmt(d)}</strong></span>` : `<span>Mesafe için konumu aç</span>`) +
      `<span>${esc(p.il)}</span><span>${CATS[p.k].ad}</span>`;
  }
  function openDetail(p) {
    open = p;
    $("dTitle").textContent = p.baslik || p.w;
    $("dTag").textContent = CATS[p.k].ad; $("dTag").style.background = CATS[p.k].renk;
    const ph = $("dPhoto");
    ph.style.backgroundImage = p.foto ? `url("${p.foto}")` : "";
    ph.style.backgroundColor = p.foto ? "" : CATS[p.k].renk;
    renderFacts(p);
    $("dTip").hidden = !p.ip; $("dTip").innerHTML = p.ip ? "<b>İpucu:</b> " + esc(p.ip) : "";
    const txt = p.metin || (p.yok ? "Bu yer için henüz bilgi eklenmedi." : "Bilgi yükleniyor…");
    $("dText").textContent = txt.length > 900 ? txt.slice(0, 900).replace(/\s\S*$/, "") + "…" : txt;
    const q = p.lat != null ? `${p.lat},${p.lng}` : encodeURIComponent((p.baslik || p.w) + " " + p.il);
    $("dMap").href = p.lat != null
      ? `https://www.google.com/maps/search/?api=1&query=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
    $("dDir").href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    $("dWiki").hidden = !p.url; if (p.url) $("dWiki").href = p.url;
    $("sheet").hidden = false;
    $("dClose").focus();
  }
  function closeDetail() { open = null; $("sheet").hidden = true; }

  // ---------- olaylar ----------
  $("search").addEventListener("input", renderIls);
  $("ilList").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) openIl(b.dataset.il); });
  $("nearBtn").addEventListener("click", openNear);
  $("locBtn").addEventListener("click", () => startLocation());
  $("back").addEventListener("click", goHome);
  $("chips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; cat = b.dataset.k; fitted = false; renderChips(); renderList(); drawPins(); });
  $("list").addEventListener("click", (e) => { const b = e.target.closest(".row"); if (b) openDetail(places[+b.dataset.i]); });
  $("dClose").addEventListener("click", closeDetail);
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

  renderIls();
  loadIlMerkez();
  // Konum izni daha önce verildiyse sessizce başlat
  if (navigator.permissions) navigator.permissions.query({ name: "geolocation" }).then((s) => { if (s.state === "granted") startLocation(); }).catch(() => {});
})();
