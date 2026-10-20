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
      const c = store.get((full ? "wk4:" : "wc:") + t);
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
        p.set("piprop", "thumbnail"); p.set("pithumbsize", "900"); p.set("pilimit", "20"); p.set("inprop", "url"); p.set("ppprop", "wikibase_item|disambiguation");
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
        store.set((full ? "wk4:" : "wc:") + t, v);
      }
    }
    return out;
  }


  // Sadece gerçek fotoğraf: jpg olmalı, adında harita/logo/uydu vb. olmamalı
  const BADIMG = /(map|harita|karte|locator|location|lokasyon|konum|relief|topo|landsat|sentinel|satellite|uydu|nasa|iss0|modis|flag|bayrak|logo|amblem|emblem|arma|coat_of_arms|seal|mühür|tabela|sign|plan|kroki|diagram|şema|chart|grafik)/i;
  const goodImg = (u) => { if (!u) return false; const d = decodeURIComponent(u); return /\.(jpe?g)(\?|\/|$)/i.test(d) && !BADIMG.test(d); };
  const KOTU_BASLIK = /(anlam ayrımı|\(il\)$| ili$|bölgesi$)/i;
  function pageInfo(pg) {
    const co = pg.coordinates && pg.coordinates[0];
    const pp = pg.pageprops || {};
    return {
      baslik: pg.title,
      lat: co ? co.lat : null, lng: co ? co.lon : null,
      foto: pg.thumbnail && goodImg(pg.thumbnail.source) ? pg.thumbnail.source : null,
      metin: pg.extract || "",
      qid: pp.wikibase_item || null,
      anlam: "disambiguation" in pp,
      url: pg.fullurl || "https://tr.wikipedia.org/wiki/" + encodeURIComponent(pg.title)
    };
  }
  async function getJSON(url, params) {
    try { return await (await fetch(url + "?" + new URLSearchParams({ format: "json", origin: "*", ...params }))).json(); }
    catch { return null; }
  }
  const filePath = (f) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f.replace(/^(File|Dosya):/, "")) + "?width=900";
  const fotoKey = (u) => decodeURIComponent(u || "").replace(/^.*\//, "").replace(/^\d+px-/, "").replace(/\?.*$/, "").replace(/_/g, " ").toLowerCase();
  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
  }

  const GENEL = new Set(["kalesi","camii","cami","müzesi","müze","gölü","göl","dağı","dağları","vadisi","şelalesi","şelaleleri","mağarası","mağaraları","medresesi","köprüsü","tepesi","yaylası","sarayı","kanyonu","adası","millî","milli","parkı","tabiat","ulu","eski","antik","kent","harabeleri","türbesi","çarşısı","hanı","manastırı","kilisesi","koyu","burnu","feneri","evi","sokağı","caddesi","yeraltı","şehri"]);
  const kelimeler = (t) => t.toLocaleLowerCase("tr").replace(/[(),.\-]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const IL_KUCUK = new Set(IL_ADLARI.map((n) => n.toLocaleLowerCase("tr")));
  // Başlık bir il/bölge/anlam ayrımı sayfası mı?
  const genelSayfa = (t) => { const b = t.toLocaleLowerCase("tr"); return IL_KUCUK.has(b) || KOTU_BASLIK.test(t); };
  function uygunBaslik(aranan, bulunan) {
    if (genelSayfa(bulunan)) return false;
    const b = bulunan.toLocaleLowerCase("tr");
    const kw = kelimeler(aranan).filter((w) => !GENEL.has(w) && !IL_KUCUK.has(w));
    return kw.length ? kw.some((w) => b.includes(w)) : kelimeler(aranan).every((w) => b.includes(w));
  }
  const ilinde = (p, lat, lng, r = 150) => { const c = ilMerkez[p.il]; return !c || km(c, { lat, lng }) < r; };
  const BOS = { yok: true, lat: null, lng: null, foto: null, metin: "", qid: null, url: null, baslik: null, anlam: false };

  // 1) Vikipedi'de bulunamayan yeri arayarak bul (ilin içinde olmalı, adı tutmalı)
  async function searchPlace(p) {
    const j = await getJSON(API, {
      action: "query", formatversion: "2", generator: "search", gsrsearch: p.w + " " + p.il, gsrlimit: "6", gsrnamespace: "0",
      prop: "coordinates|pageimages|extracts|info|pageprops", exintro: "1", explaintext: "1", exlimit: "6",
      piprop: "thumbnail", pithumbsize: "900", inprop: "url", ppprop: "wikibase_item|disambiguation", colimit: "max"
    });
    const pages = ((j && j.query && j.query.pages) || []).sort((a, b) => a.index - b.index);
    const ok = pages.find((pg) => {
      const co = pg.coordinates && pg.coordinates[0];
      return !(pg.pageprops && "disambiguation" in pg.pageprops) && uygunBaslik(p.w, pg.title) && (!co || ilinde(p, co.lat, co.lon, 120));
    });
    if (ok) Object.assign(p, pageInfo(ok), { yok: false });
  }
  // 2) Vikiveri: resim (P18), koordinat (P625), Türkçe açıklama, İngilizce Vikipedi adı
  async function wikidata(list) {
    const need = list.filter((p) => p.qid);
    for (let i = 0; i < need.length; i += 50) {
      const part = need.slice(i, i + 50);
      const j = await getJSON("https://www.wikidata.org/w/api.php", {
        action: "wbgetentities", ids: part.map((p) => p.qid).join("|"), props: "claims|descriptions|sitelinks", languages: "tr|en", sitefilter: "enwiki"
      });
      const ents = (j && j.entities) || {};
      part.forEach((p) => {
        const e = ents[p.qid]; if (!e) return;
        const val = (prop) => { const c = e.claims && e.claims[prop]; return c && c[0] && c[0].mainsnak && c[0].mainsnak.datavalue && c[0].mainsnak.datavalue.value; };
        p.adaylar = ((e.claims && e.claims.P18) || []).map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter((f) => f && goodImg(f)).map(filePath);
        const co = val("P625");
        if (p.lat == null && co && ilinde(p, co.latitude, co.longitude)) { p.lat = co.latitude; p.lng = co.longitude; }
        const d = e.descriptions && (e.descriptions.tr || e.descriptions.en);
        if (d) p.aciklama = d.value;
        if (e.sitelinks && e.sitelinks.enwiki) p.en = e.sitelinks.enwiki.title;
      });
    }
  }
  // 3) İngilizce Vikipedi: fotoğraf ve (Türkçesi yoksa) metin
  async function enwiki(list) {
    const need = list.filter((p) => p.en && (!p.foto || !p.metin));
    for (let i = 0; i < need.length; i += 20) {
      const part = need.slice(i, i + 20);
      const j = await getJSON("https://en.wikipedia.org/w/api.php", {
        action: "query", formatversion: "2", redirects: "1", prop: "pageimages|extracts", piprop: "thumbnail", pithumbsize: "900", pilimit: "20",
        exintro: "1", explaintext: "1", exlimit: "20", titles: part.map((p) => p.en).join("|")
      });
      const pages = {}; ((j && j.query && j.query.pages) || []).forEach((pg) => (pages[pg.title] = pg));
      const red = {}; ((j && j.query && j.query.redirects) || []).forEach((r) => (red[r.from] = r.to));
      part.forEach((p) => {
        const pg = pages[red[p.en] || p.en]; if (!pg) return;
        if (pg.thumbnail && goodImg(pg.thumbnail.source)) (p.adaylar = p.adaylar || []).push(pg.thumbnail.source);
        if (!p.metin && pg.extract) p.metinEn = pg.extract;
      });
    }
  }
  // 4) Commons: konumun yakınında çekilmiş fotoğraflar, 5) Commons'ta adıyla arama
  async function commonsNear(p) {
    if (p.lat == null) return;
    const j = await getJSON("https://commons.wikimedia.org/w/api.php", {
      action: "query", list: "geosearch", gscoord: p.lat + "|" + p.lng, gsradius: "2000", gsnamespace: "6", gslimit: "25"
    });
    const kw = kelimeler(p.w).filter((w) => !IL_KUCUK.has(w));
    const files = ((j && j.query && j.query.geosearch) || []).map((g) => g.title).filter(goodImg);
    // Adı geçen dosyalar önce
    files.sort((a, b) => (kw.some((w) => b.toLocaleLowerCase("tr").includes(w)) ? 1 : 0) - (kw.some((w) => a.toLocaleLowerCase("tr").includes(w)) ? 1 : 0));
    (p.adaylar = p.adaylar || []).push(...files.slice(0, 8).map(filePath));
  }
  async function commonsSearch(p) {
    const j = await getJSON("https://commons.wikimedia.org/w/api.php", {
      action: "query", list: "search", srsearch: (p.baslik || p.w).replace(/\s*\(.*\)$/, "") + " " + p.il + " filetype:bitmap", srnamespace: "6", srlimit: "10"
    });
    const files = ((j && j.query && j.query.search) || []).map((r) => r.title).filter(goodImg);
    (p.adaylar = p.adaylar || []).push(...files.map(filePath));
  }
  // Aynı ildeki yerler aynı fotoğrafı paylaşmasın
  function fotoDagit(list) {
    const used = new Set();
    list.forEach((p) => { if (p.foto) { const k = fotoKey(p.foto); if (used.has(k)) p.foto = null; else used.add(k); } });
    list.forEach((p) => {
      if (p.foto) return;
      const f = (p.adaylar || []).find((u) => !used.has(fotoKey(u)));
      if (f) { p.foto = f; used.add(fotoKey(f)); }
    });
  }
  async function improve(list, redraw) {
    await pool(list.filter((p) => p.yok), 4, searchPlace); redraw();
    await wikidata(list);
    await enwiki(list);
    fotoDagit(list); redraw();
    await pool(list.filter((p) => !p.foto), 4, commonsNear);
    fotoDagit(list); redraw();
    await pool(list.filter((p) => !p.foto), 4, commonsSearch);
    fotoDagit(list); redraw();
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
  let ilMerkezHazir = Promise.resolve();

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
    show("city"); ensureMap();
    if (ilMerkez[il]) map.setView([ilMerkez[il].lat, ilMerkez[il].lng], 9);
    renderChips(); renderList(); drawPins();
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
  const KEEP = ["baslik", "lat", "lng", "foto", "metin", "metinEn", "aciklama", "url", "qid", "yok", "en"];
  let token = 0;
  async function fill(list) {
    const my = ++token;
    $("sortInfo").textContent = "Bilgiler yükleniyor…";
    await ilMerkezHazir;
    const todo = list.filter((p) => { const c = store.get("wf3:" + p.w + "|" + p.il); if (c) { Object.assign(p, c); return false; } return true; });
    const redraw = () => { if (my !== token) return; renderList(); drawPins(); if (open && todo.includes(open)) openDetail(open); };
    if (todo.length) {
      const r = await wiki(todo.map((p) => p.w));
      todo.forEach((p) => {
        Object.assign(p, r[p.w] || {});
        // Aynı adlı başka bir yere gittiyse (il dışında) yok say, aramaya bırak
        if (p.baslik && (p.anlam || genelSayfa(p.baslik) || (p.lat != null && ilMerkez[p.il] && !ilinde(p, p.lat, p.lng)))) Object.assign(p, BOS);
      });
      redraw();
      await improve(todo, redraw);
      todo.filter((p) => p.baslik || p.yok).forEach((p) => { const o = {}; KEEP.forEach((k) => (o[k] = p[k])); store.set("wf3:" + p.w + "|" + p.il, o); });
    }
    if (my !== token) return;
    $("sortInfo").textContent = "";
    renderList(); drawPins();
  }
  const visible = () => {
    const seen = new Set();
    return places.filter((p) => {
      if (cat !== "hepsi" && p.k !== cat) return false;
      const key = p.baslik ? p.baslik + "|" + p.il : null;
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
  };
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
    const ad = (p.baslik || p.w).replace(/\s*\(.*\)$/, "");
    let txt = p.metin || p.metinEn || "";
    if (!txt && p.aciklama) txt = ad + ": " + p.aciklama + ".";
    if (!txt) txt = p.yok === undefined && !p.baslik ? "Bilgi yükleniyor…" : `${ad}, ${p.il} ilinde görülmeye değer ${CATS[p.k].ad.toLocaleLowerCase("tr")} noktalarından biri. Ayrıntılar için aşağıdaki bağlantıya bakabilirsin.`;
    if (!p.metin && p.metinEn) txt = "(İngilizce kaynaktan) " + txt;
    $("dText").textContent = txt.length > 900 ? txt.slice(0, 900).replace(/\s\S*$/, "") + "…" : txt;
    const q = p.lat != null ? `${p.lat},${p.lng}` : encodeURIComponent(ad + " " + p.il);
    $("dMap").href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    $("dDir").href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    const link = p.url || (p.en ? "https://en.wikipedia.org/wiki/" + encodeURIComponent(p.en) : "https://www.google.com/search?q=" + encodeURIComponent(ad + " " + p.il));
    $("dWiki").href = link;
    $("dWiki").textContent = p.url ? "Vikipedi'de devamını oku" : p.en ? "Vikipedi'de (İngilizce) oku" : "İnternette daha fazla bilgi ara";
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
  ilMerkezHazir = loadIlMerkez();
  // Konum izni daha önce verildiyse sessizce başlat
  if (navigator.permissions) navigator.permissions.query({ name: "geolocation" }).then((s) => { if (s.state === "granted") startLocation(); }).catch(() => {});
})();
